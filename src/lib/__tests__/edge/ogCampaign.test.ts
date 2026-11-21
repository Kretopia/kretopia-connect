// Runs the real og-campaign function (Open Graph previews for /fund/<slug>). It used to fail to compile: a perimeter call
// sat inside the synchronous formatMoney helper, where `await` is not allowed and `req` does not exist. Now the module
// loads, the perimeter runs once per request before any database work, a crawler gets the campaign's preview, a person is
// sent to the campaign page, and a perimeter refusal answers with the guard's own response.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";
import { GuardError } from "../../../../supabase/functions/_shared/guard";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  perimeter: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  createClient: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: (...a: unknown[]) => world.createClient(...a) }));
vi.mock("../../../../supabase/functions/_shared/publicPerimeter.ts", () => ({ publicPerimeter: (...a: unknown[]) => world.perimeter(...a) }));

const env: Record<string, string> = { SUPABASE_URL: "https://legacy.test", SUPABASE_SERVICE_ROLE_KEY: "service-key" };
const CAMPAIGN = {
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
  status: "live",
};

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] }, serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/og-campaign/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  world.db = new MemoryDb().seed("campaigns", [CAMPAIGN]);
  world.perimeter = vi.fn(async () => {});
  world.createClient = vi.fn(() => ({ from: (t: string) => (world.db as MemoryDb).from(t) }));
});

const get = (path: string, userAgent = "Mozilla/5.0 (iPhone)") =>
  world.handler!(new Request(`https://edge.test${path}`, { headers: { "user-agent": userAgent } }));

describe("og-campaign", () => {
  it("loads (it used to fail to compile) and registers its handler", () => {
    expect(world.handler).toBeTypeOf("function");
  });

  it("a crawler gets the campaign's preview, and the perimeter ran once, first", async () => {
    const res = await get("/og-campaign?slug=night-shoot", "facebookexternalhit/1.1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Night Shoot | Kretopia Fund on Kretopia" />');
    expect(html).toContain('<meta property="og:image" content="https://cdn.test/cover.jpg" />');
    expect(html).toMatch(/25% funded · €10,000 goal · \d+ days left/);
    expect(world.perimeter).toHaveBeenCalledTimes(1);
    expect(world.perimeter).toHaveBeenCalledWith(expect.any(Request), "og-campaign", 60);
  });

  it("a person is sent to the campaign page; an unknown campaign goes to the Fund page; no slug is refused", async () => {
    const person = await get("/og-campaign/night-shoot");
    expect(person.status).toBe(302);
    expect(person.headers.get("Location")).toBe("https://www.kretopia.com/fund/night-shoot");
    const unknown = await get("/og-campaign?slug=nope", "twitterbot");
    expect(unknown.headers.get("Location")).toBe("https://www.kretopia.com/fund");
    expect((await get("/og-campaign")).status).toBe(400);
  });

  it("a perimeter refusal answers with the guard's response, before any database work", async () => {
    world.perimeter = vi.fn(async () => { throw new GuardError(429, { error: "Too many requests" }); });
    const res = await get("/og-campaign?slug=night-shoot", "facebookexternalhit/1.1");
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests" });
    expect(world.createClient).not.toHaveBeenCalled();
  });

  it("an unexpected perimeter failure is a safe, generic error", async () => {
    world.perimeter = vi.fn(async () => { throw new Error("configuration unavailable"); });
    const res = await get("/og-campaign?slug=night-shoot", "facebookexternalhit/1.1");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something went wrong" });
  });

  it("an OPTIONS preflight is answered without touching the perimeter", async () => {
    const res = await world.handler!(new Request("https://edge.test/og-campaign", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect(world.perimeter).not.toHaveBeenCalled();
  });
});
