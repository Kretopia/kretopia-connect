// Runs the real guest web-search handler. The guest path stays open (no sign-in), but every cost is bounded on the server
// BEFORE a provider is called: a server-only switch, a per-address budget, a global durable quota owned by the database. If the
// quota cannot be consulted the search is refused ("fail closed"); nothing here is a counter held in the function's memory.
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  perimeterAllowed: true,
  perimeterError: false,
  quota: { mode: "ok" as "ok" | "denied" | "missing" },
  rpcCalls: [] as string[],
  fetch: vi.fn(),
}));

// The per-address perimeter (npm client) and the quota/search client (esm client) share one fake.
const rpc = async (name: string) => {
  world.rpcCalls.push(name);
  if (name === "consume_ai_feature_call") {
    return world.perimeterError ? { data: null, error: { message: "down" } } : { data: [{ allowed: world.perimeterAllowed }], error: null };
  }
  if (name === "consume_public_presence_search") {
    if (world.quota.mode === "missing") return { data: null, error: { message: "function public.consume_public_presence_search() does not exist", code: "PGRST202" } };
    return { data: world.quota.mode === "ok", error: null };
  }
  return { data: null, error: { message: "unexpected" } };
};
vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: () => ({ rpc }) }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: () => ({ rpc }) }));

const env: Record<string, string> = {
  SUPABASE_URL: "https://backend.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", FIRECRAWL_API_KEY: "fc-key", LOVABLE_API_KEY: "ai-key",
  PUBLIC_PRESENCE_SEARCH_ENABLED: "true",
};

beforeAll(async () => {
  // The edge runtime has AbortSignal.timeout; the DOM environment these tests run in may not.
  if (typeof AbortSignal.timeout !== "function") {
    (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout = (ms: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms).unref?.();
      return controller.signal;
    };
  }
  vi.stubGlobal("Deno", { serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; }, env: { get: (k: string) => env[k] } });
  await import("../../../../supabase/functions/public-digital-presence/index.ts");
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  world.handler!(new Request("https://edge.test", { method: "POST", headers: { "x-forwarded-for": "203.0.113.9", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const urls = () => world.fetch.mock.calls.map(([u]) => String(u));
const quotaCalls = () => world.rpcCalls.filter((n) => n === "consume_public_presence_search").length;
const SAVED = { ...env };

const firecrawl = (status = 200, data: unknown = { data: { web: [{ title: "Sam Rivers - Director", url: "https://example.com/sam", description: "Film director based in Lyon" }] } }) =>
  new Response(JSON.stringify(data), { status });
const ai = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"indices":[0]}' } }] }), { status: 200 });

beforeEach(() => {
  Object.assign(env, SAVED);
  world.perimeterAllowed = true;
  world.perimeterError = false;
  world.quota = { mode: "ok" };
  world.rpcCalls = [];
  world.fetch.mockReset();
  world.fetch.mockImplementation(async (url: string) => (String(url).includes("firecrawl") ? firecrawl() : ai()));
  vi.stubGlobal("fetch", world.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("public-digital-presence: the guest path stays open, the cost does not", () => {
  it("searches for a guest with no session: one quota unit, one provider search, ranked results", async () => {
    const res = await post({ query: "Sam Rivers director" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ available: true, source: "web", results: [{ url: "https://example.com/sam" }] });
    expect(quotaCalls()).toBe(1);
    expect(urls().filter((u) => u.includes("firecrawl"))).toEqual(["https://api.firecrawl.dev/v2/search"]);
    expect(JSON.parse(String((world.fetch.mock.calls[0][1] as RequestInit).body))).toEqual({ query: "Sam Rivers director", limit: 20 });
  });

  it("answers a preflight without touching any budget", async () => {
    const res = await world.handler!(new Request("https://edge.test", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect(world.rpcCalls).toEqual([]);
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it("treats a pasted address as search words: the server never fetches it", async () => {
    await post({ query: "http://169.254.169.254/latest/meta-data/" });
    expect(urls().some((u) => u.includes("169.254"))).toBe(false);
    expect(JSON.parse(String((world.fetch.mock.calls[0][1] as RequestInit).body))).toEqual({ query: "http://169.254.169.254/latest/meta-data/", limit: 20 });
  });
});

describe("public-digital-presence: every refusal happens before a provider is called", () => {
  const nothingSpent = () => {
    expect(world.fetch).not.toHaveBeenCalled();
  };

  it("is off unless the server-only switch says otherwise", async () => {
    for (const value of [undefined, "", "false", "TRUE", "1", "yes"]) {
      if (value === undefined) delete env.PUBLIC_PRESENCE_SEARCH_ENABLED; else env.PUBLIC_PRESENCE_SEARCH_ENABLED = value;
      world.rpcCalls = [];
      expect((await post({ query: "Sam Rivers" })).status).toBe(503);
      expect(quotaCalls()).toBe(0);
    }
    nothingSpent();
  });

  it("refuses a caller over the per-address budget with a 429", async () => {
    world.perimeterAllowed = false;
    expect((await post({ query: "Sam Rivers" })).status).toBe(429);
    expect(quotaCalls()).toBe(0);
    nothingSpent();
  });

  it("refuses when the per-address budget cannot be read", async () => {
    world.perimeterError = true;
    const res = await post({ query: "Sam Rivers" });
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(quotaCalls()).toBe(0);
    nothingSpent();
  });

  it("refuses a request that is not a POST, too large, not JSON, or has no usable query, without spending quota", async () => {
    expect((await world.handler!(new Request("https://edge.test", { method: "GET", headers: { "x-forwarded-for": "203.0.113.9" } }))).status).toBe(405);
    expect((await post("x".repeat(3000))).status).toBe(413);
    expect((await post("{not json")).status).toBe(400);
    for (const query of [undefined, "", "a", " ", 5, null, ["Sam"], { q: "Sam" }, "x".repeat(201)]) expect((await post({ query })).status).toBe(400);
    expect((await post(null)).status).toBe(400);
    expect(quotaCalls()).toBe(0);
    nothingSpent();
  });

  it("refuses when the provider is not configured, before the quota", async () => {
    delete env.FIRECRAWL_API_KEY;
    expect((await post({ query: "Sam Rivers" })).status).toBe(503);
    expect(quotaCalls()).toBe(0);
    nothingSpent();
  });

  it("fails closed when the database quota cannot be consulted (missing function, outage): no search, no guess", async () => {
    world.quota = { mode: "missing" };
    const res = await post({ query: "Sam Rivers" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ available: false, error: "Search protection unavailable" });
    nothingSpent();
  });

  it("refuses with a 429 when the global quota is spent, and the answer does not depend on who asks", async () => {
    world.quota = { mode: "denied" };
    for (const forwarded of ["203.0.113.9", "198.51.100.1", "unknown"]) expect((await post({ query: "Sam Rivers" }, { "x-forwarded-for": forwarded })).status).toBe(429);
    nothingSpent();
  });

  it("does not let a caller choose its own limit, window or quota bucket", async () => {
    await post({ query: "Sam Rivers", limit: 9999, scrape: true, bucket: "mine", windowSeconds: 1, cap: 1_000_000, key: "x" });
    expect(JSON.parse(String((world.fetch.mock.calls[0][1] as RequestInit).body))).toEqual({ query: "Sam Rivers", limit: 20 });
    expect(world.rpcCalls.filter((n) => n === "consume_public_presence_search")).toHaveLength(1);
  });
});

describe("public-digital-presence: what an anonymous caller is told", () => {
  it("never receives the provider's answer or status: it can describe our account", async () => {
    world.fetch.mockImplementation(async () => new Response(JSON.stringify({ error: "Insufficient credits. Plan: Growth. Key: fc-live-123" }), { status: 402 }));
    const res = await post({ query: "Sam Rivers" });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toMatch(/credits|Growth|fc-live|402/);
    expect(JSON.parse(text)).toEqual({ available: false, error: "Search is temporarily unavailable" });
  });

  it("keeps the real sources when the ranking model fails", async () => {
    world.fetch.mockImplementation(async (url: string) => (String(url).includes("firecrawl") ? firecrawl() : new Response("down", { status: 500 })));
    const body = await (await post({ query: "Sam Rivers" })).json();
    expect(body).toMatchObject({ available: true, aiAvailable: false });
    expect(body.results).toHaveLength(1);
  });
});
