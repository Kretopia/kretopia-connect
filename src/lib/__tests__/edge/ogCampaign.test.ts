// Runs the real og-campaign function (Open Graph previews for /fund/<slug>), as production runs it: the repository copy
// had drifted (an older version plus a perimeter call pasted into a synchronous helper, which did not compile) and now
// mirrors the deployed function and its two helpers. These tests pin production's behaviour: the public read boundary
// refuses anything but a read before any database work, a slug with control characters is refused, only an approved,
// public campaign gets a preview, a database error is a 503, and the campaign link is encoded and escaped.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";
import { publicReadBoundary, publicSlug, publicUuid } from "../../../../supabase/functions/_shared/publicBoundary";
import { RequestBodyError, readBoundedText, readJsonObject } from "../../../../supabase/functions/_shared/requestBody";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  createClient: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: (...a: unknown[]) => world.createClient(...a) }));

const env: Record<string, string> = { SUPABASE_URL: "https://legacy.test", SUPABASE_SERVICE_ROLE_KEY: "service-key" };
const campaign = (over: Record<string, unknown> = {}) => ({
  slug: "night-shoot",
  title: "Night Shoot",
  tagline: "A short film shot in one night.",
  story: null,
  cover_image_url: "https://cdn.test/cover.jpg",
  goal_amount: 10000,
  total_raised: 2500,
  backer_count: 12,
  currency: "EUR",
  deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
  status: "active",
  moderation_status: "approved",
  ...over,
});

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] }, serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } });
  await import("../../../../supabase/functions/og-campaign/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  world.db = new MemoryDb().seed("campaigns", [
    campaign(),
    campaign({ slug: "under-review", title: "Under Review", moderation_status: "pending" }),
    campaign({ slug: "draft-one", title: "Draft One", status: "draft" }),
    campaign({ slug: "café & co", title: 'Café "&" Co' }),
  ]);
  world.createClient = vi.fn(() => ({ from: (t: string) => (world.db as MemoryDb).from(t) }));
});

const CRAWLER = "facebookexternalhit/1.1";
const request = (path: string, init: RequestInit & { userAgent?: string } = {}) =>
  world.handler!(new Request(`https://edge.test${path}`, { ...init, headers: { "user-agent": init.userAgent ?? "Mozilla/5.0 (iPhone)", ...(init.headers ?? {}) } }));

describe("og-campaign, as deployed", () => {
  it("loads and registers its handler (the old repository copy did not compile)", () => {
    expect(world.handler).toBeTypeOf("function");
  });

  it("a crawler gets the preview of an approved, public campaign", async () => {
    const res = await request("/og-campaign?slug=night-shoot", { userAgent: CRAWLER });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Night Shoot | Kretopia Fund on Kretopia" />');
    expect(html).toContain('<meta property="og:url" content="https://www.kretopia.com/fund/night-shoot" />');
    expect(html).toContain('<meta property="og:image" content="https://cdn.test/cover.jpg" />');
    expect(html).toMatch(/25% funded · €10,000 goal · \d+ days left/);
  });

  it("a campaign under review or not yet public is never previewed: it goes to the Fund page", async () => {
    for (const slug of ["under-review", "draft-one", "nope"]) {
      const res = await request(`/og-campaign?slug=${slug}`, { userAgent: CRAWLER });
      expect([slug, res.status, res.headers.get("Location")]).toEqual([slug, 302, "https://www.kretopia.com/fund"]);
    }
  });

  it("a person is sent to the campaign page; the slug can come from the path; the link is encoded", async () => {
    const byPath = await request("/og-campaign/night-shoot");
    expect(byPath.status).toBe(302);
    expect(byPath.headers.get("Location")).toBe("https://www.kretopia.com/fund/night-shoot");
    const encoded = await request(`/og-campaign?slug=${encodeURIComponent("café & co")}`);
    expect(encoded.headers.get("Location")).toBe("https://www.kretopia.com/fund/caf%C3%A9%20%26%20co");
  });

  it("the campaign's text and link are escaped in the preview", async () => {
    const html = await (await request(`/og-campaign?slug=${encodeURIComponent("café & co")}`, { userAgent: CRAWLER })).text();
    expect(html).toContain("<h1>Café &quot;&amp;&quot; Co</h1>");
    expect(html).toContain('<link rel="canonical" href="https://www.kretopia.com/fund/caf%C3%A9%20%26%20co" />');
  });

  it("no slug, or a slug with control characters, is refused before any database work", async () => {
    expect((await request("/og-campaign")).status).toBe(400);
    expect((await request(`/og-campaign?slug=${encodeURIComponent("bad\u0007slug")}`)).status).toBe(400);
    expect(world.createClient).not.toHaveBeenCalled();
  });

  it("a database error is a 503 that is not cached", async () => {
    (world.db as MemoryDb).hooks.failOn = (table) => (table === "campaigns" ? { message: "down" } : null);
    const res = await request("/og-campaign?slug=night-shoot", { userAgent: CRAWLER });
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Preview unavailable");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("the boundary answers a preflight and refuses writes and over-long links, before any database work", async () => {
    const preflight = await request("/og-campaign", { method: "OPTIONS" });
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
    expect((await request("/og-campaign?slug=night-shoot", { method: "POST", body: "{}" })).status).toBe(405);
    expect((await request(`/og-campaign?slug=${"a".repeat(8200)}`)).status).toBe(414);
    expect(world.createClient).not.toHaveBeenCalled();
  });
});

describe("the shared public helpers it uses", () => {
  it("publicSlug accepts printable slugs up to 200 characters; publicUuid accepts only UUIDs", () => {
    expect(publicSlug("night-shoot")).toBe(true);
    expect(publicSlug("café & co")).toBe(true);
    expect(publicSlug(null)).toBe(false);
    expect(publicSlug("")).toBe(false);
    expect(publicSlug("a".repeat(201))).toBe(false);
    expect(publicSlug("tab\there")).toBe(false);
    expect(publicSlug("del\u007f")).toBe(false);
    expect(publicUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(publicUuid("night-shoot")).toBe(false);
  });

  it("publicReadBoundary refuses a body that is too large or not UTF-8 on a permitted method", async () => {
    const cors = { "Access-Control-Allow-Origin": "*" };
    const big = new Request("https://edge.test/x", { method: "POST", body: "x".repeat(70_000) });
    expect((await publicReadBoundary(big, cors, true))?.status).toBe(413);
    const bad = new Request("https://edge.test/x", { method: "POST", body: new Uint8Array([0xff, 0xfe]) });
    expect((await publicReadBoundary(bad, cors, true))?.status).toBe(400);
    expect(await publicReadBoundary(new Request("https://edge.test/x"), cors)).toBeNull();
  });

  it("readBoundedText and readJsonObject enforce the byte budget, UTF-8 and a JSON object", async () => {
    expect(await readBoundedText(new Request("https://edge.test", { method: "POST", body: "hello" }))).toBe("hello");
    await expect(readBoundedText(new Request("https://edge.test", { method: "POST", body: "x".repeat(20) }), 10)).rejects.toMatchObject({ status: 413 });
    await expect(readJsonObject(new Request("https://edge.test", { method: "POST", body: "{}" }))).rejects.toMatchObject({ status: 415 });
    const json = (body: string) => new Request("https://edge.test", { method: "POST", body, headers: { "content-type": "application/json; charset=utf-8" } });
    expect(await readJsonObject(json('{"a":1}'))).toEqual({ a: 1 });
    await expect(readJsonObject(json("[1]"))).rejects.toBeInstanceOf(RequestBodyError);
    await expect(readJsonObject(json("{bad"))).rejects.toMatchObject({ status: 400 });
  });
});
