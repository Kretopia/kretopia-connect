// Runs the real desk-agent handler: a message to project chat and a call link wait for the person's approval instead of
// running when a model chooses them; an approved action runs once its approval record is proven; and every tool the
// function runs on its own authority leaves an orch_actions row. See supabase/functions/_shared/deskApproval.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";
import { DESK_OUTWARD_TOOLS, deskActionRows, deskToolGate } from "../../../../supabase/functions/_shared/deskApproval";
import { editedArgsKeepTargets } from "../../../../supabase/functions/_shared/approvalHardening";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  toolCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  invoke: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, key: string) =>
    key === "anon-key"
      ? { auth: { getUser: async () => ({ data: { user: { id: "owner-1", email: "owner@example.test" } }, error: null }) } }
      : {
          from: (table: string) => (world.db as MemoryDb).from(table),
          rpc: (name: string) => {
            const result =
              name === "user_has_project_access"
                ? { data: true, error: null }
                : name === "consume_copilot_message"
                  ? { data: { allowed: true, used: 1 }, error: null }
                  : { data: null, error: null };
            return { single: async () => result, then: (ok: (r: unknown) => unknown) => Promise.resolve(result).then(ok) };
          },
          functions: { invoke: (...args: unknown[]) => world.invoke(...args) },
        },
}));

const env: Record<string, string> = {
  LOVABLE_API_KEY: "gateway-key",
  SUPABASE_URL: "https://backend.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  SUPABASE_ANON_KEY: "anon-key",
};

const gateway = vi.fn(async () =>
  new Response(
    JSON.stringify({
      usage: { total_tokens: 42 },
      choices: [
        {
          message: {
            content: "",
            tool_calls: world.toolCalls.map((t, i) => ({ id: `call-${i}`, function: { name: t.name, arguments: JSON.stringify(t.args) } })),
          },
        },
      ],
    }),
    { status: 200 },
  ),
);

beforeAll(async () => {
  vi.stubGlobal("Deno", { serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; }, env: { get: (k: string) => env[k] } });
  vi.stubGlobal("fetch", gateway);
  await import("../../../../supabase/functions/desk-agent/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

const seed = () =>
  new MemoryDb()
    .seed("projects", [{ id: "proj-1", title: "Night Shoot", status: "active", created_by: "owner-1", client_user_id: null, currency: "USD" }])
    .seed("project_collaborators", [{ project_id: "proj-1", user_id: "maya-1", role: "creative", profiles: { full_name: "Maya Santos" } }])
    .seed("profiles", [{ user_id: "owner-1", subscription_tier: "free" }]);

const call = (body: Record<string, unknown>) =>
  world.handler!(
    new Request("https://edge.test", {
      method: "POST",
      headers: { Authorization: "Bearer user-token", Origin: "https://www.kretopia.com", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const db = () => world.db as MemoryDb;

beforeEach(() => {
  world.db = seed();
  world.toolCalls = [];
  world.invoke = vi.fn(async () => ({ data: { url: "https://call.example.test/room" }, error: null }));
  gateway.mockClear();
});

describe("desk-agent's own model turn", () => {
  it("queues a chat message for approval: nothing is posted, the proposal carries the exact text", async () => {
    world.toolCalls = [{ name: "send_message_to_collaborator", args: { message: "Call sheet is up", mention_user_id: "maya-1" } }];
    const res = await call({ project_id: "proj-1", message: "tell Maya the call sheet is up" });
    const out = await res.json();

    expect(res.status).toBe(200);
    expect(db().writes("project_messages", "insert")).toHaveLength(0);
    const [proposal] = db().rows("orch_actions").filter((a) => a.status === "proposed");
    expect(proposal).toMatchObject({
      tool_name: "send_message_to_collaborator",
      risk_level: "requires_approval",
      source: "desk_agent",
      user_id: "owner-1",
      tool_args: { project_id: "proj-1", message: "Call sheet is up", mention_user_id: "maya-1" },
      preview_body: "@Maya Call sheet is up",
    });
    expect(db().rows("orch_runs").find((r) => r.id === proposal.run_id)?.status).toBe("awaiting_approval");
    expect(out.actions[0].result.needs_approval).toBe(true);
    expect(out.reply).toMatch(/Approve/);
  });

  it("queues a video call for approval: no room is created, no link is posted", async () => {
    world.toolCalls = [{ name: "start_video_call", args: {} }];
    const out = await (await call({ project_id: "proj-1", message: "start a call" })).json();

    expect(world.invoke).not.toHaveBeenCalled();
    expect(db().rows("orch_actions").filter((a) => a.status === "proposed").map((a) => a.tool_name)).toEqual(["start_video_call"]);
    expect(out.actions[0].result.needs_approval).toBe(true);
  });

  it("still runs a task immediately, and records it as an executed action of this run", async () => {
    world.toolCalls = [{ name: "create_task", args: { title: "Book the van" } }];
    await call({ project_id: "proj-1", message: "add a task to book the van" });

    expect(db().rows("project_tasks").map((t) => t.title)).toEqual(["Book the van"]);
    const receipt = db().rows("orch_runs").find((r) => r.source === "desk_agent" && r.intent_classified === "ThriveDesk chat turn");
    const recorded = db().rows("orch_actions").filter((a) => a.run_id === receipt?.id);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ tool_name: "create_task", status: "auto_executed", risk_level: "safe_auto", source: "desk_agent", error: null });
    expect(recorded[0].executed_at).toBeTruthy();
  });

  it("a model that writes approval fields into its arguments still only queues", async () => {
    world.toolCalls = [{ name: "send_message_to_collaborator", args: { message: "hi", _source: "agent_orchestrator", _agent_action_id: "act-x" } }];
    await call({ project_id: "proj-1", message: "say hi" });
    expect(db().writes("project_messages", "insert")).toHaveLength(0);
  });
});

describe("a direct call", () => {
  it("without the approved-door marker (the orchestrator's automatic tier, or anyone) is queued, not run", async () => {
    await call({ _tool: "start_video_call", project_id: "proj-1" });
    expect(world.invoke).not.toHaveBeenCalled();
    expect(gateway).not.toHaveBeenCalled();
    expect(db().rows("orch_actions").filter((a) => a.status === "proposed").map((a) => a.tool_name)).toEqual(["start_video_call"]);
  });

  const approvedAction = (over: Record<string, unknown> = {}) => {
    db().seed("orch_runs", [{ id: "run-a", user_id: "owner-1", status: "awaiting_approval" }]);
    db().seed("orch_actions", [
      {
        id: "act-1",
        run_id: "run-a",
        user_id: "owner-1",
        tool_name: "send_message_to_collaborator",
        tool_args: { project_id: "proj-1", message: "Wrap at 6", mention_user_id: null },
        status: "approved",
        ...over,
      },
    ]);
  };

  it("for an approved action runs once the approval record is proven, posting the approved text (not 'undefined')", async () => {
    approvedAction();
    db().seed("orch_approvals", [{ action_id: "act-1", user_id: "owner-1", decision: "approved" }]);
    const res = await call({ _tool: "send_message_to_collaborator", _source: "agent_orchestrator", _agent_action_id: "act-1", project_id: "proj-1", message: "Wrap at 6" });

    expect(res.status).toBe(200);
    expect(db().rows("project_messages").map((m) => m.message)).toEqual(["Wrap at 6"]);
    // The orchestrator updates the approved action's own row; desk-agent adds no second one.
    expect(db().rows("orch_actions").map((a) => a.id)).toEqual(["act-1"]);
  });

  it("for an action with no approval record runs nothing", async () => {
    approvedAction();
    const out = await (await call({ _tool: "send_message_to_collaborator", _source: "agent_orchestrator", _agent_action_id: "act-1", project_id: "proj-1", message: "Wrap at 6" })).json();
    expect(db().writes("project_messages", "insert")).toHaveLength(0);
    expect(out.actions[0]).toMatchObject({ ok: false });
  });

  it("for an action approved on another project runs nothing", async () => {
    approvedAction({ tool_args: { project_id: "proj-other", message: "Wrap at 6" } });
    db().seed("orch_approvals", [{ action_id: "act-1", user_id: "owner-1", decision: "approved" }]);
    await call({ _tool: "send_message_to_collaborator", _source: "agent_orchestrator", _agent_action_id: "act-1", project_id: "proj-1", message: "Wrap at 6" });
    expect(db().writes("project_messages", "insert")).toHaveLength(0);
  });

  it("from an approved plan (no action id) runs, and is recorded as executed", async () => {
    await call({ _tool: "start_video_call", _source: "agent_orchestrator", project_id: "proj-1", message: "Start the call" });
    expect(world.invoke).toHaveBeenCalledTimes(1);
    expect(db().rows("orch_actions")).toEqual([expect.objectContaining({ tool_name: "start_video_call", status: "executed", source: "desk_agent" })]);
  });
});

describe("deskToolGate and deskActionRows (pure)", () => {
  it("names exactly the tools that reach other people", () => {
    expect([...DESK_OUTWARD_TOOLS].sort()).toEqual(["send_message_to_collaborator", "start_video_call"]);
  });

  it("lets other tools run and holds outward ones to an approved door", () => {
    expect(deskToolGate({ tool: "create_task", requestedTool: null, source: undefined, agentActionId: undefined })).toEqual({ run: true, proveAction: null });
    expect(deskToolGate({ tool: "start_video_call", requestedTool: null, source: "agent_orchestrator", agentActionId: "a" })).toEqual({ run: false, queue: true });
    expect(deskToolGate({ tool: "start_video_call", requestedTool: "start_video_call", source: "human_ui", agentActionId: null })).toEqual({ run: false, queue: true });
    expect(deskToolGate({ tool: "start_video_call", requestedTool: "start_video_call", source: "agent_orchestrator", agentActionId: " a-1 " })).toEqual({ run: true, proveAction: "a-1" });
    expect(deskToolGate({ tool: "start_video_call", requestedTool: "start_video_call", source: "agent_orchestrator", agentActionId: 7 })).toEqual({ run: true, proveAction: null });
  });

  it("records failures with their error, skips proposals, and records nothing for an approved action or an unmarked direct call", () => {
    const actions = [
      { tool: "create_task", args: { title: "x" }, result: { id: "t1" }, ok: true },
      { tool: "mark_task_done", args: {}, result: { error: "no match" }, ok: false },
      { tool: "start_video_call", args: {}, result: { needs_approval: true }, ok: true },
    ];
    const rows = deskActionRows({ runId: "r", userId: "u", call: { requestedTool: null, source: undefined, agentActionId: undefined }, actions, now: "T" });
    expect(rows.map((r) => [r.tool_name, r.status, r.error])).toEqual([
      ["create_task", "auto_executed", null],
      ["mark_task_done", "failed", "no match"],
    ]);
    expect(deskActionRows({ runId: "r", userId: "u", call: { requestedTool: "create_task", source: "agent_orchestrator", agentActionId: "a" }, actions })).toEqual([]);
    expect(deskActionRows({ runId: "r", userId: "u", call: { requestedTool: "create_task", source: undefined, agentActionId: undefined }, actions })).toEqual([]);
  });

  it("an approval may edit the message text, not the project it is posted in", () => {
    const proposed = { project_id: "proj-1", message: "a" };
    expect(editedArgsKeepTargets("send_message_to_collaborator", proposed, { project_id: "proj-1", message: "b" })).toEqual({ ok: true });
    expect(editedArgsKeepTargets("send_message_to_collaborator", proposed, { project_id: "proj-2", message: "a" })).toEqual({ ok: false, field: "project_id" });
    expect(editedArgsKeepTargets("start_video_call", { project_id: "proj-1" }, { project_id: "proj-2" })).toEqual({ ok: false, field: "project_id" });
  });
});
