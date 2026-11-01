// Runs the real copilot-collaborator-tools handler for add_collaborator: an approval covers one person on one project,
// once. Agents without an approval add nobody; a name fallback never swaps the approved person for another.
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  caller: "owner-1" as string | null,
  authUsers: new Set<string>(),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, key: string) =>
    key === "anon-key"
      ? { auth: { getUser: async () => (world.caller ? { data: { user: { id: world.caller } }, error: null } : { data: { user: null }, error: { message: "bad" } }) } }
      : {
          from: (table: string) => (world.db as MemoryDb).from(table),
          auth: { admin: { getUserById: async (id: string) => (world.authUsers.has(id) ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: "not found" } }) } },
        },
}));

const env: Record<string, string> = { SUPABASE_URL: "https://backend.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key" };

beforeAll(async () => {
  vi.stubGlobal("Deno", { serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; }, env: { get: (k: string) => env[k] } });
  await import("../../../../supabase/functions/copilot-collaborator-tools/index.ts");
});

const OWNER = "owner-1";
const ALICE = "user-alice";
const BOB = "user-bob";
const ACTION = "act-1";
const fresh = (ageMs = 5_000) => new Date(Date.now() - ageMs).toISOString();

const seed = (over: { tool?: string; args?: Record<string, unknown>; status?: string; ageMs?: number; records?: boolean } = {}) =>
  new MemoryDb()
    .seed("projects", [{ id: "proj-1", title: "Short film", created_by: OWNER }, { id: "proj-2", title: "Other", created_by: OWNER }])
    .seed("profiles", [
      { user_id: ALICE, full_name: "Alice Martin", username: "alice", is_claimed: true },
      { user_id: BOB, full_name: "Bob Stone", username: "bob", is_claimed: true },
    ])
    .seed("public_profiles_safe", [{ user_id: ALICE, full_name: "Alice Martin", username: "alice", avatar_url: null, role: "editor" }])
    .seed("orch_actions", [{
      id: ACTION, user_id: OWNER, status: over.status ?? "approved", tool_name: over.tool ?? "add_collaborator",
      tool_args: over.args ?? { project_id: "proj-1", user_id_to_add: ALICE }, decided_at: fresh(over.ageMs), executed_at: null,
    }])
    .seed("orch_approvals", over.records === false ? [] : [{ id: "ap-1", action_id: ACTION, user_id: OWNER, decision: "approved", edited_args: null, decided_at: fresh(over.ageMs) }]);

const call = (body: Record<string, unknown>) =>
  world.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer user-token", Origin: "https://www.kretopia.com" }, body: JSON.stringify(body) }));
const add = (over: Record<string, unknown> = {}) => call({ _tool: "add_collaborator", project_id: "proj-1", user_id_to_add: ALICE, role: "member", ...over });
const members = (db: MemoryDb) => db.rows("project_collaborators");
const actionStatus = (db: MemoryDb) => db.rows("orch_actions").find((r) => r.id === ACTION)!.status;

beforeEach(() => {
  world.caller = OWNER;
  world.authUsers = new Set([ALICE, BOB]);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("add_collaborator: an agent adds nobody without a proven approval", () => {
  it("answers 428 and adds no one when a desk agent calls it with no approved action", async () => {
    const db = (world.db = seed()) as MemoryDb;
    const res = await add({ _source: "desk_agent" });
    expect(res.status).toBe(428);
    expect(members(db)).toHaveLength(0);
    expect(db.writes("notifications")).toHaveLength(0);
    expect(actionStatus(db)).toBe("approved");
  });

  it("still lets the owner add someone from the app (the person is the approval)", async () => {
    const db = (world.db = seed()) as MemoryDb;
    const res = await add({});
    expect(res.status).toBe(200);
    expect(members(db)).toHaveLength(1);
    expect(members(db)[0]).toMatchObject({ project_id: "proj-1", user_id: ALICE, invited_by: OWNER });
  });

  it("refuses everyone but the project owner, approval or not", async () => {
    const db = (world.db = seed()) as MemoryDb;
    world.caller = "someone-else";
    expect((await add({ _agent_action_id: ACTION, _source: "agent_orchestrator" })).status).toBe(403);
    expect(members(db)).toHaveLength(0);
  });
});

describe("add_collaborator: an approval covers this person on this project, once", () => {
  it("adds the approved person and consumes the approval", async () => {
    const db = (world.db = seed()) as MemoryDb;
    const res = await add({ _agent_action_id: ACTION, _source: "agent_orchestrator" });
    expect(res.status).toBe(200);
    expect(members(db)).toHaveLength(1);
    expect(actionStatus(db)).toBe("executed");
  });

  it("refuses a replay: the same approval cannot add the person again after they were removed", async () => {
    const db = (world.db = seed()) as MemoryDb;
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent" })).status).toBe(200);
    db.tables.project_collaborators = []; // the owner removes them afterwards
    const again = await add({ _agent_action_id: ACTION, _source: "desk_agent" });
    expect(again.status).toBe(409);
    expect(members(db)).toHaveLength(0);
  });

  it("lets only one of several simultaneous requests add the person", async () => {
    const db = (world.db = seed()) as MemoryDb;
    const answers = await Promise.all(Array.from({ length: 5 }, () => add({ _agent_action_id: ACTION, _source: "agent_orchestrator" })));
    const codes = answers.map((a) => a.status);
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(members(db)).toHaveLength(1);
    expect(db.writes("notifications", "insert")).toHaveLength(1);
  });

  it("refuses an approval for Alice used to add Bob, and one for project 1 used on project 2", async () => {
    const db = (world.db = seed()) as MemoryDb;
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent", user_id_to_add: BOB })).status).toBe(403);
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent", project_id: "proj-2" })).status).toBe(403);
    expect(members(db)).toHaveLength(0);
    expect(actionStatus(db)).toBe("approved"); // refused requests do not spend the approval
  });

  it("refuses an approval of another tool, another user's approval, an unrecorded approval and an expired one", async () => {
    const wrongTool = (world.db = seed({ tool: "send_message", args: { project_id: "proj-1", user_id_to_add: ALICE } })) as MemoryDb;
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent" })).status).toBe(403);
    const noRecord = (world.db = seed({ records: false })) as MemoryDb;
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent" })).status).toBe(428);
    const expired = (world.db = seed({ ageMs: 31 * 60_000 })) as MemoryDb;
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent" })).status).toBe(410);
    const notApproved = (world.db = seed({ status: "proposed" })) as MemoryDb;
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent" })).status).toBe(428);
    for (const db of [wrongTool, noRecord, expired, notApproved]) expect(members(db)).toHaveLength(0);
  });

  it("uses the edited arguments of the approval, not the original proposal", async () => {
    const db = (world.db = seed()) as MemoryDb;
    db.tables.orch_approvals[0].edited_args = { project_id: "proj-1", user_id_to_add: BOB };
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent" })).status).toBe(403); // asks for Alice, Bob was approved
    expect((await add({ _agent_action_id: ACTION, _source: "desk_agent", user_id_to_add: BOB })).status).toBe(200);
    expect(members(db)[0]).toMatchObject({ user_id: BOB });
  });
});

describe("add_collaborator: the name fallback never swaps the approved person", () => {
  it("adds no one, and spends nothing, when the approved id does not exist and a name would resolve to someone else", async () => {
    const db = (world.db = seed({ args: { project_id: "proj-1", user_id_to_add: "ghost-id" } })) as MemoryDb;
    const res = await add({ _agent_action_id: ACTION, _source: "agent_orchestrator", user_id_to_add: "ghost-id", invitee_name: "Alice" });
    expect(res.status).toBe(409);
    expect(members(db)).toHaveLength(0);
    expect(actionStatus(db)).toBe("approved");
  });

  it("keeps the fallback for a person acting in the app, where nothing was approved", async () => {
    const db = (world.db = seed()) as MemoryDb;
    const res = await add({ user_id_to_add: "ghost-id", invitee_name: "Alice" });
    expect(res.status).toBe(200);
    expect(members(db)[0]).toMatchObject({ user_id: ALICE });
  });
});

describe("add_collaborator: a failed insert gives the approval back", () => {
  it("releases the claim so the person can approve again", async () => {
    const db = (world.db = seed()) as MemoryDb;
    db.hooks.failOn = (table, op) => (table === "project_collaborators" && op === "insert" ? { message: "constraint" } : null);
    const res = await add({ _agent_action_id: ACTION, _source: "agent_orchestrator" });
    expect(res.status).toBe(500);
    expect(members(db)).toHaveLength(0);
    expect(actionStatus(db)).toBe("approved");
  });
});
