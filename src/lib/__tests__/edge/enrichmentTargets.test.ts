// Runs the real enrichment handlers. A member may enrich their own profile; naming someone else's changes nothing and calls no
// provider; an admin or the platform (service role, from batch-enrich-profiles) may enrich any profile.
import { webcrypto } from "node:crypto";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, type RecordedWrite } from "./fakeSupabase";

const world = vi.hoisted(() => ({
  current: "",
  handlers: {} as Record<string, (req: Request) => Promise<Response>>,
  client: null as unknown,
  getUser: vi.fn(),
  rpc: vi.fn(),
  fetch: vi.fn(),
}));

// The perimeter (session check + rate limit) uses the npm client; the functions use their own pinned esm.sh clients.
vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: () => ({ auth: { getUser: world.getUser }, rpc: world.rpc }) }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.49.4", () => ({ createClient: () => world.client }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: () => world.client }));

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ADMIN = "99999999-9999-4999-8999-999999999999";
const env: Record<string, string> = {
  SUPABASE_URL: "https://backend.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key",
  FIRECRAWL_API_KEY: "fc-key", LOVABLE_API_KEY: "ai-key",
};

beforeAll(async () => {
  vi.stubGlobal("Deno", { serve: (h: (req: Request) => Promise<Response>) => { world.handlers[world.current] = h; }, env: { get: (k: string) => env[k] } });
  for (const name of ["enrich-creator-profile", "enrich-press-links", "enrich-credits"]) {
    world.current = name;
    await import(`../../../../supabase/functions/${name}/index.ts`);
  }
});

let writes: RecordedWrite[];
const profiles: Record<string, Record<string, unknown>> = {};
const admins = new Set<string>();
const setup = () => {
  writes = [];
  for (const k of Object.keys(profiles)) delete profiles[k];
  profiles[ME] = { user_id: ME, full_name: "Me Myself", is_claimed: true };
  profiles[OTHER] = { user_id: OTHER, full_name: "Someone Else", is_claimed: true };
  admins.clear();
  world.client = makeFakeClient(({ table, filters }) => {
    if (table === "profiles") return { data: profiles[String(filters.user_id)] ?? null };
    if (table === "user_roles") return { data: admins.has(String(filters.user_id)) && filters.role === "admin" ? { role: "admin" } : null };
    return {};
  }, writes);
};

const call = (name: string, body: unknown, token = "member-token") =>
  world.handlers[name](new Request("https://edge.test", { method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: "https://www.kretopia.com" }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  setup();
  world.fetch.mockReset();
  world.fetch.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [], choices: [] }), { status: 200 }));
  vi.stubGlobal("fetch", world.fetch);
  world.getUser.mockReset();
  world.getUser.mockImplementation(async (token: string) =>
    token === "member-token" ? { data: { user: { id: ME } }, error: null }
    : token === "admin-token" ? { data: { user: { id: ADMIN } }, error: null }
    : { data: { user: null }, error: { message: "bad" } });
  world.rpc.mockReset();
  world.rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const FUNCTIONS = ["enrich-creator-profile", "enrich-press-links"] as const;

describe.each(FUNCTIONS)("%s: whose profile it enriches", (name) => {
  it("works on the caller's own profile", async () => {
    const res = await call(name, { user_id: ME, scrape_website: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it("refuses another member's profile with the answer a missing profile gets, calling no provider and writing nothing", async () => {
    const stranger = await call(name, { user_id: OTHER, scrape_website: true });
    const missing = await call(name, { user_id: "33333333-3333-4333-8333-333333333333", scrape_website: true });
    expect(stranger.status).toBe(404);
    expect(await stranger.json()).toEqual(await missing.json());
    expect(world.fetch).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("refuses an unclaimed public profile too: a member does not enrich what nobody owns", async () => {
    profiles[OTHER].is_claimed = false;
    expect((await call(name, { user_id: OTHER, scrape_website: true })).status).toBe(404);
    expect(world.fetch).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("lets an admin enrich any profile", async () => {
    admins.add(ADMIN);
    expect((await call(name, { user_id: OTHER, scrape_website: false }, "admin-token")).status).toBe(200);
  });

  it("treats a user_roles row of someone else, or a failed role lookup, as no admin right", async () => {
    admins.add(OTHER);
    expect((await call(name, { user_id: OTHER, scrape_website: false })).status).toBe(404);
  });

  it("lets the platform enrich any profile with the service role, with no session to verify", async () => {
    const res = await call(name, { user_id: OTHER, scrape_website: false }, "service-key");
    expect(res.status).toBe(200);
    expect(world.getUser).not.toHaveBeenCalled();
  });

  it("refuses a user_id that is not an id, and a request with none", async () => {
    for (const user_id of ["abc", `${OTHER}' or '1'='1`, 7, [OTHER], { id: OTHER }]) expect((await call(name, { user_id })).status).toBe(400);
    expect((await call(name, {})).status).toBe(400);
    expect(world.fetch).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("refuses a session that does not verify with a 401, and a caller over the rate limit with a 429, before looking at the target", async () => {
    expect((await call(name, { user_id: ME }, "forged-token")).status).toBe(401);
    world.rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });
    expect((await call(name, { user_id: ME })).status).toBe(429);
    expect(world.fetch).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
});

describe("enrich-credits: a batch across every member is not a member's to run", () => {
  it("refuses a member who names no profile: it used to enrich everyone's credits at our cost", async () => {
    const res = await call("enrich-credits", {});
    expect(res.status).toBe(403);
    expect(world.fetch).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
    expect((await call("enrich-credits", { batch_size: 100 })).status).toBe(403);
    expect((await call("enrich-credits", { user_id: null })).status).toBe(403);
  });

  it("refuses another member's credits, and answers like a missing profile", async () => {
    const res = await call("enrich-credits", { user_id: OTHER });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Profile not found" });
    expect(writes).toHaveLength(0);
  });

  it("works on the caller's own credits", async () => {
    expect((await call("enrich-credits", { user_id: ME })).status).toBe(200);
  });

  it("lets an admin or the platform run the batch", async () => {
    admins.add(ADMIN);
    expect((await call("enrich-credits", {}, "admin-token")).status).toBe(200);
    expect((await call("enrich-credits", {}, "service-key")).status).toBe(200);
  });

  it("refuses a session that does not verify, and a caller over the rate limit gets a 429", async () => {
    expect((await call("enrich-credits", { user_id: ME }, "forged-token")).status).toBe(401);
    world.rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });
    expect((await call("enrich-credits", { user_id: ME })).status).toBe(429);
    expect(world.fetch).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("refuses an id that is not an id, even from an admin", async () => {
    admins.add(ADMIN);
    expect((await call("enrich-credits", { user_id: "abc" }, "admin-token")).status).toBe(400);
  });
});
