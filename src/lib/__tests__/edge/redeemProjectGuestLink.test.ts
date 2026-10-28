import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

// Runs the real redeem-project-guest-link handler against an in-memory database: a revoked, expired or used-up link
// grants nothing, and a link with a use limit lets exactly that many people in even when they redeem at once.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as unknown as import("./memoryDb").MemoryDb,
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2.45.0", () => ({
  createClient: (_url: string, _key: string, opts?: { global?: { headers?: { Authorization?: string } } }) => {
    const bearer = opts?.global?.headers?.Authorization;
    return bearer
      ? { auth: { getUser: async () => ({ data: { user: { id: bearer.replace("Bearer ", "") } }, error: null }) } }
      : { from: (t: string) => world.db.from(t) };
  },
}));

const PROJECT = "p1";
const redeem = (userId: string, token = "tok") =>
  world.handler!(new Request("https://fn.example/redeem", { method: "POST", headers: { Authorization: `Bearer ${userId}` }, body: JSON.stringify({ token }) }));
const link = (over: Record<string, unknown> = {}) => ({
  id: "l1", token: "tok", project_id: PROJECT, expires_at: null, max_uses: null, uses: 0, revoked_at: null, permissions: {}, guest_role: "viewer", created_by: "owner", ...over,
});
const members = () => world.db.rows("project_collaborators");
const usesOf = () => world.db.rows("project_guest_links")[0].uses as number;

beforeAll(async () => {
  (globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: (k: string) => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s" } as Record<string, string>)[k] },
    serve: (h: (r: Request) => Promise<Response>) => { world.handler = h; },
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/redeem-project-guest-link/index.ts");
});
beforeEach(() => {
  world.db = new MemoryDb();
});

describe("redeem-project-guest-link", () => {
  it("lets a signed-in person in as a guest and counts the use", async () => {
    world.db.seed("project_guest_links", [link()]);
    const res = await redeem("u1");
    expect(res.status).toBe(200);
    expect(members()).toHaveLength(1);
    expect(members()[0]).toMatchObject({ user_id: "u1", role: "guest", status: "accepted" });
    expect(usesOf()).toBe(1);
  });

  it("grants nothing on a revoked, expired or used-up link", async () => {
    const cases: Record<string, Record<string, unknown>> = {
      revoked: { revoked_at: "2026-10-01T00:00:00Z" },
      expired: { expires_at: "2020-01-01T00:00:00Z" },
      used_up: { max_uses: 1, uses: 1 },
    };
    for (const [name, over] of Object.entries(cases)) {
      world.db = new MemoryDb();
      world.db.seed("project_guest_links", [link(over)]);
      expect((await redeem("u1")).status, name).toBe(410);
      expect(members(), name).toHaveLength(0);
    }
  });

  it("a single-use link lets exactly one of five simultaneous redeemers in", async () => {
    world.db.seed("project_guest_links", [link({ max_uses: 1 })]);
    const results = await Promise.all(["u1", "u2", "u3", "u4", "u5"].map((u) => redeem(u)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s !== 200).every((s) => s === 409 || s === 410)).toBe(true);
    expect(members()).toHaveLength(1);
    expect(usesOf()).toBe(1);
  });

  it("a link capped at three lets three of ten in, and the counter says three", async () => {
    world.db.seed("project_guest_links", [link({ max_uses: 3 })]);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => redeem(`u${i}`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(members()).toHaveLength(3);
    expect(usesOf()).toBe(3);
  });

  it("an unlimited link lets everyone in at once and counts every use (no lost update)", async () => {
    world.db.seed("project_guest_links", [link()]);
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => redeem(`u${i}`)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(members()).toHaveLength(8);
    expect(usesOf()).toBe(8);
  });

  it("a link revoked while a redemption is in flight does not let that person in", async () => {
    world.db.seed("project_guest_links", [link()]);
    const originalFrom = world.db.from.bind(world.db);
    world.db.from = ((table: string) => {
      const q = originalFrom(table) as Record<string, (...a: unknown[]) => unknown>;
      if (table === "project_guest_links") {
        const update = q.update.bind(q);
        q.update = (patch: unknown) => {
          // the owner revokes the link right before this use is counted
          if ("uses" in (patch as object)) world.db.rows(table).forEach((r) => { r.revoked_at = "2026-10-28T00:00:00Z"; });
          return update(patch);
        };
      }
      return q;
    }) as typeof world.db.from;
    const res = await redeem("u1");
    expect(res.status).toBe(410);
    expect(members()).toHaveLength(0);
  });
});
