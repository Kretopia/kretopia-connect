import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

// Runs the real accept-project-invitation handler against an in-memory database: only a pending invitation can be
// accepted, a removed or rejected one stays that way, and an owner who removes the collaborator while the invitee
// is accepting wins.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as unknown as import("./memoryDb").MemoryDb,
  user: { id: "u1", email: "ada@example.com", email_confirmed_at: "2026-01-01" } as Record<string, unknown> | null,
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: (r: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, _key: string, opts?: { global?: { headers?: unknown } }) =>
    opts?.global?.headers
      ? { auth: { getUser: async () => ({ data: { user: world.user } }) } }
      : { from: (t: string) => world.db.from(t) },
}));

const PROJECT = "11111111-1111-4111-8111-111111111111";
const call = () =>
  world.handler!(new Request("https://fn.example/accept", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ projectId: PROJECT }) }));
const row = (over: Record<string, unknown> = {}) => ({
  id: "c1", project_id: PROJECT, user_id: "u1", email: null, status: "pending", role: "editor", invited_by: "owner", invited_at: "2026-10-01T00:00:00Z", ...over,
});

beforeAll(async () => {
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s" } as Record<string, string>)[k] } };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await import("../../../../supabase/functions/accept-project-invitation/index.ts");
});
beforeEach(() => {
  world.db = new MemoryDb();
  world.user = { id: "u1", email: "ada@example.com", email_confirmed_at: "2026-01-01" };
});

const statusOf = (id = "c1") => world.db.rows("project_collaborators").find((r) => r.id === id)?.status;

describe("accept-project-invitation", () => {
  it("accepts a pending invitation addressed to the account", async () => {
    world.db.seed("project_collaborators", [row()]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "accepted" });
    expect(statusOf()).toBe("accepted");
  });

  it("accepts a pending invitation sent to the confirmed email of the signed-in person", async () => {
    world.db.seed("project_collaborators", [row({ user_id: null, email: "ada@example.com" })]);
    expect((await call()).status).toBe(200);
    expect(statusOf()).toBe("accepted");
    expect(world.db.rows("project_collaborators")[0].user_id).toBe("u1");
  });

  it("does not let an unconfirmed email claim an invitation sent to that address", async () => {
    world.user = { id: "u1", email: "ada@example.com", email_confirmed_at: null };
    world.db.seed("project_collaborators", [row({ user_id: null, email: "ada@example.com" })]);
    const res = await call();
    expect(res.status).toBe(403);
    expect(statusOf()).toBe("pending");
  });

  it("never brings back a removed or rejected invitation", async () => {
    for (const status of ["removed", "rejected", "declined"]) {
      world.db = new MemoryDb();
      world.db.seed("project_collaborators", [row({ status })]);
      const res = await call();
      expect(res.status).toBe(404);
      expect(statusOf()).toBe(status);
    }
  });

  it("an owner who removes the collaborator while the invitee accepts wins: the row is not accepted again", async () => {
    world.db.seed("project_collaborators", [row()]);
    // The owner's removal lands after the handler read the pending row and before its update.
    const originalFrom = world.db.from.bind(world.db);
    world.db.from = ((table: string) => {
      const q = originalFrom(table) as Record<string, (...a: unknown[]) => unknown>;
      if (table === "project_collaborators") {
        const update = q.update.bind(q);
        q.update = (patch: unknown) => {
          if ((patch as { status?: string }).status === "accepted") world.db.rows(table).forEach((r) => { r.status = "removed"; });
          return update(patch);
        };
      }
      return q;
    }) as typeof world.db.from;

    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "no_invitation" });
    expect(statusOf()).toBe("removed");
    expect(world.db.rows("notifications")).toHaveLength(0);
  });

  it("reports an existing member as already a member", async () => {
    world.db.seed("project_collaborators", [row({ status: "accepted" })]);
    expect(await (await call()).json()).toMatchObject({ status: "already_member" });
  });
});
