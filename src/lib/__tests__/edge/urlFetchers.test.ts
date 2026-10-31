import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Runs the real fetch-og-data, fetch-portfolio-data and fetch-youtube-playlist handlers with a scripted network.
const world = vi.hoisted(() => ({ handlers: {} as Record<string, (r: Request) => Promise<Response>>, current: "" }));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (h: any) => { world.handlers[world.current] = h; } }));
vi.mock("https://deno.land/x/zod@v3.22.4/mod.ts", async () => await import("zod"));
// The handlers now require a verified caller before touching the network:
// authenticate as a signed-in user so the SSRF checks below are what fails.
vi.mock("npm:@supabase/supabase-js@2", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-1111-1111-111111111111" } }, error: null }) },
  }),
}));

const fetchMock = vi.fn();
const html = (title: string) => `<html><head><meta property="og:title" content="${title}"><meta property="og:description" content="d"></head></html>`;

beforeAll(async () => {
  (AbortSignal as any).timeout ??= () => new AbortController().signal;
  (globalThis as any).Deno = { resolveDns: async () => ["93.184.216.34"], env: { get: () => "https://test.example" } };
  vi.stubGlobal("fetch", (...a: unknown[]) => fetchMock(...a));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const n of ["fetch-og-data", "fetch-portfolio-data", "fetch-youtube-playlist"]) {
    world.current = n;
    await import(`../../../../supabase/functions/${n}/index.ts`);
  }
});
beforeEach(() => fetchMock.mockReset());

const call = (fn: string, body: unknown) =>
  world.handlers[fn](
    new Request("https://fn.example", {
      method: "POST",
      headers: { Authorization: "Bearer test-user-token" },
      body: JSON.stringify(body),
    }),
  );
const requested = () => fetchMock.mock.calls.map((c) => String(c[0]));

// Addresses the old substring blocklist ("10.", "127.0.0.1", ...) lets through.
const INTERNAL = ["http://169.254.170.2/v2/credentials", "http://[::1]/admin", "http://[::ffff:127.0.0.1]/", "http://[::ffff:169.254.169.254]/latest/meta-data", "http://printer.local/"];

describe("fetch-og-data", () => {
  it("refuses a call with no Authorization header: 401, no request made", async () => {
    const res = await world.handlers["fetch-og-data"](
      new Request("https://fn.example", { method: "POST", body: JSON.stringify({ url: "https://good.example/article" }) }),
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(INTERNAL)("refuses %s with a 400 and makes no request", async (url) => {
    const res = await call("fetch-og-data", { url });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "URL not allowed", success: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a public page cannot redirect the request to an internal address", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    const res = await call("fetch-og-data", { url: "https://good.example/article" });
    expect(res.status).toBe(400);
    expect(requested()).toEqual(["https://good.example/article"]);
  });

  it("still reads a normal public page", async () => {
    fetchMock.mockResolvedValueOnce(new Response(html("Hello"), { status: 200 }));
    const res = await call("fetch-og-data", { url: "https://good.example/article" });
    expect(res.status).toBe(200);
    expect((await res.json()).data.title).toBe("Hello");
  });

  it("'verified domain' means the domain or its subdomain, not a lookalike", async () => {
    const verified = async (url: string) => {
      fetchMock.mockResolvedValueOnce(new Response(html("x"), { status: 200 }));
      return (await (await call("fetch-og-data", { url })).json()).isVerifiedDomain;
    };
    expect(await verified("https://www.imdb.com/title/tt1")).toBe(true);
    expect(await verified("https://imdb.com/title/tt1")).toBe(true);
    expect(await verified("https://imdb.com.evil.example/title/tt1")).toBe(false);
    expect(await verified("https://fakeimdb.com/title/tt1")).toBe(false);
  });
});

describe("fetch-portfolio-data", () => {
  it.each(INTERNAL)("never requests %s, whichever platform the URL pretends to be", async (base) => {
    for (const url of [`${base}?next=spotify.com/track/abc`, `${base}/track/abc?spotify.com`, `${base}?behance.net/gallery/1`, base]) {
      fetchMock.mockReset();
      const res = await call("fetch-portfolio-data", { url });
      // Provider oEmbed calls may carry the pasted URL as an encoded query value; what matters is the host reached.
      const hosts = requested().map((u) => new URL(u).hostname);
      expect(hosts.filter((h) => /^169\.254\.|^\[?::|\.local$/.test(h))).toEqual([]);
      expect(res.status).toBe(200); // a blocked page just yields no extra data
      expect((await res.json()).data.title).toBeUndefined();
    }
  });

  it("still reads a normal public page", async () => {
    fetchMock.mockResolvedValueOnce(new Response(html("My site"), { status: 200 }));
    const body = await (await call("fetch-portfolio-data", { url: "https://good.example/work" })).json();
    expect(body.data.title).toBe("My site");
  });
});

describe("fetch-youtube-playlist", () => {
  it.each(["x&foo=1", "PL123", "abc/../../x", "a".repeat(80), 42, null, undefined])("rejects playlistId %j without any request", async (playlistId) => {
    const res = await call("fetch-youtube-playlist", { playlistId });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a well-formed id reaches only youtube.com", async () => {
    fetchMock.mockResolvedValue(new Response("<feed></feed>", { status: 200 }));
    await call("fetch-youtube-playlist", { playlistId: "PLabcdefghijk123" });
    expect(requested().length).toBeGreaterThan(0);
    expect(requested().every((u) => new URL(u).hostname === "www.youtube.com")).toBe(true);
  });
});
