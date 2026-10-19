import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  handlers: {} as Record<string, (r: Request) => Promise<Response>>,
  current: "" as string,
  db: null as any,
  invoke: null as any,
  user: null as string | null,
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (h: any) => { world.handlers[world.current] = h; } }));
const fakeClient = () => ({
  from: (t: string) => world.db.from(t),
  functions: { invoke: (...a: unknown[]) => world.invoke(...a) },
  auth: { admin: { getUserById: async () => ({ data: { user: { email: "a@example.com" } } }) } },
});
vi.mock("https://esm.sh/@supabase/supabase-js@2.45.0", () => ({ createClient: () => fakeClient() }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.58.0", () => ({ createClient: () => fakeClient() }));
vi.mock("../../../../supabase/functions/_shared/admin-guard.ts", () => ({ requireAdminOrCron: async () => ({ ok: true, userId: null, viaCron: true }) }));
vi.mock("../../../../supabase/functions/_shared/require-user.ts", () => ({
  requireUser: async () => (world.user ? { ok: true, userId: world.user } : { ok: false, response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) }),
}));

const ENV: Record<string, string> = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", LOVABLE_API_KEY: "ai" };
const fetchMock = vi.fn();
const get = (name: string) => world.handlers[name];
const call = (name: string, body: unknown = {}) => get(name)(new Request("https://fn.example", { method: "POST", body: JSON.stringify(body) }));

beforeAll(async () => {
  (globalThis as any).Deno = { env: { get: (k: string) => ENV[k] }, serve: (h: any) => { world.handlers[world.current] = h; } };
  vi.stubGlobal("fetch", (...a: unknown[]) => fetchMock(...a));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  for (const n of ["speed-session-reminders", "speed-session-autocancel", "speed-session-recap", "generate-match-explanation", "generate-ice-breakers"]) {
    world.current = n;
    await import(`../../../../supabase/functions/${n}/index.ts`);
  }
});

const soon = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
beforeEach(() => {
  world.db = new MemoryDb();
  world.invoke = vi.fn(async () => ({ data: {}, error: null }));
  world.user = "u1";
  fetchMock.mockReset();
});

describe("speed-session-reminders: a cron that failed does not report success", () => {
  const seed = () => {
    world.db.seed("speed_sessions", [{ id: "s1", title: "Night", starts_at: soon(60), status: "scheduled", reminders_sent: {}, slot_seconds: 300 }]);
    world.db.seed("speed_session_rsvps", [{ session_id: "s1", user_id: "a" }]);
  };

  it("counts a failed email as an error instead of a sent one", async () => {
    seed();
    world.invoke = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    const res = await call("speed-session-reminders");
    const json = await res.json();
    expect(json.emails).toBe(0);
    expect(json.errors).toBeGreaterThan(0);
    expect(json.ok).toBe(false);
  });

  it("is a 200 with ok:false when only some of the work failed, and a 500 when none of it worked", async () => {
    seed();
    world.invoke = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    world.db.hooks.failOn = (t: string, op: string) => (t === "notifications" && op === "insert" ? { message: "db" } : null);
    expect((await call("speed-session-reminders")).status).toBe(500);
  });

  it("a clean run is 200 ok:true", async () => {
    seed();
    const res = await call("speed-session-reminders");
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(world.db.rows("speed_sessions")[0].reminders_sent).toHaveProperty("in_one_hour");
  });

  it("a fatal error is a 500 with no internal detail", async () => {
    world.db.hooks.failOn = () => { throw new Error("secret detail"); };
    const res = await call("speed-session-reminders");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret detail/);
  });
});

describe("speed-session-autocancel: no announcement for a change that was not made", () => {
  it("does not notify, and answers 500, when the session could not be switched to group mode", async () => {
    world.db.seed("speed_sessions", [{ id: "s1", title: "Night", starts_at: soon(30), status: "scheduled", fallback_mode: "pair", canceled_reason: null }]);
    world.db.seed("speed_session_rsvps", [{ session_id: "s1", user_id: "a" }]);
    world.db.hooks.failOn = (t: string, op: string) => (t === "speed_sessions" && op === "update" ? { message: "db" } : null);
    const res = await call("speed-session-autocancel");
    expect(res.status).toBe(500);
    expect(world.db.rows("notifications")).toHaveLength(0);
  });
});

describe("generate-match-explanation / generate-ice-breakers: no anonymous AI spend, no invented answers", () => {
  it("refuses a caller without a session", async () => {
    world.user = null;
    expect((await call("generate-match-explanation", { currentUser: {}, targetUser: {} })).status).toBe(401);
    expect((await call("generate-ice-breakers", { recipientId: "r" })).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("an AI failure is a 502 with no fabricated score or reasons and no error text", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 500 }));
    const res = await call("generate-match-explanation", { currentUser: { full_name: "A" }, targetUser: { full_name: "B" } });
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json).toEqual({ error: "Match explanation unavailable" });
  });

  it("the ice-breaker fallback no longer echoes the internal error", async () => {
    fetchMock.mockRejectedValue(new Error("gateway secret detail"));
    const res = await call("generate-ice-breakers", { recipientId: "r", recipientName: "R" });
    const json = await res.json();
    expect(JSON.stringify(json)).not.toMatch(/secret detail/);
    expect(json.error).toBe("Ice breakers unavailable");
  });
});
