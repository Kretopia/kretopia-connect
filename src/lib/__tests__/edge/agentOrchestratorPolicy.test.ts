// Runs the real agent-orchestrator: the governance policy decides (a registry row marked safe cannot make a shared-state
// tool run on its own; a locked tool never runs, from a new request or an old proposal), the person's auto-run setting
// holds inside the planner too, every attempt leaves a row, and a failure says whether it may have run anyway.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  planner: [] as Array<Array<{ name: string; args?: Record<string, unknown> }>>,
  plannerBodies: [] as Array<Record<string, unknown>>,
  tool: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.39.3", () => ({
  createClient: () => ({
    from: (t: string) => (world.db as MemoryDb).from(t),
    rpc: async () => ({ data: null, error: null }),
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: null }) },
  }),
}));
// The model: the classifier answers first, then each planner turn takes the next scripted list of tool calls.
vi.mock("../../../../supabase/functions/_shared/fetchWithTimeout.ts", () => ({
  fetchWithTimeout: async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (!body.tools) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ agent_kind: "project_manager", reasoning: "test" }) } }] }));
    world.plannerBodies.push(body);
    const calls = (world.planner.shift() ?? []).map((c, i) => ({ id: `c${i}`, function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } }));
    return new Response(JSON.stringify({ choices: [{ message: { content: "", tool_calls: calls } }], usage: { total_tokens: 10 } }));
  },
}));

const env: Record<string, string> = { SUPABASE_URL: "https://legacy.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key", LOVABLE_API_KEY: "gateway-key" };
const REGISTRY = [
  { tool_name: "assign_task", agent_kind: "project_manager", description: "Assign a task to a member in ThriveDesk", risk_level: "safe_auto", handler: "desk-agent", args_schema: { type: "object" }, enabled: true },
  { tool_name: "create_task", agent_kind: "project_manager", description: "Create a task", risk_level: "safe_auto", handler: "desk-agent", args_schema: { type: "object" }, enabled: true },
  { tool_name: "find_user", agent_kind: "orchestrator", description: "Find a user", risk_level: "safe_auto", handler: "copilot-collaborator-tools", args_schema: { type: "object" }, enabled: true },
  { tool_name: "delete_project", agent_kind: "project_manager", description: "Delete a project", risk_level: "requires_approval", handler: "copilot-collaborator-tools", args_schema: { type: "object" }, enabled: true },
];

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  vi.stubGlobal("fetch", vi.fn((...a: unknown[]) => world.tool(...a)));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/agent-orchestrator/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  world.db = new MemoryDb().seed("orch_tool_registry", REGISTRY);
  world.planner = [];
  world.plannerBodies = [];
  world.tool = vi.fn(async () => new Response(JSON.stringify({ ok: true, task_id: "t1" }), { status: 200 }));
  (console.log as unknown as ReturnType<typeof vi.fn>).mockClear();
});

const post = (body: Record<string, unknown>) =>
  world.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
const db = () => world.db as MemoryDb;
const actions = () => db().rows("orch_actions");
const toolCalls = () => world.tool.mock.calls.map(([url]) => String(url));

describe("the governance policy decides what runs", () => {
  it("a shared-state tool the registry marks safe waits for approval, and the tightening is logged", async () => {
    world.planner = [[{ name: "assign_task", args: { task_id: "t9", assignee_id: "u2" } }]];
    const res = await post({ intent: "Give the colour pass to Lena" });
    const body = await res.json();
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0]).toMatchObject({ tool_name: "assign_task", status: "proposed", risk_level: "requires_approval", preview_title: "Assign a task" });
    expect(toolCalls()).toHaveLength(0);
    const logged = (console.log as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([l]) => String(l)).find((l) => l.includes("kreto_tool_policy"));
    expect(JSON.parse(logged!)).toEqual({ kreto_tool_policy: { tool: "assign_task", registry: "safe_auto", governed: "requires_approval", reason: "It changes someone else's work, so it waits for you." } });
  });

  it("the model sees Kretopia's names and which tools are locked", async () => {
    await post({ intent: "anything" });
    const described = (world.plannerBodies[0].tools as Array<{ function: { name: string; description: string } }>).map((t) => `${t.function.name}: ${t.function.description}`);
    expect(described).toContain("assign_task: [requires_approval] Assign a task to a member in Studio");
    expect(described).toContain("delete_project: [locked] Delete a project");
    expect(described.join(" ")).not.toMatch(/Thrive/);
  });

  it("asking for a locked tool runs nothing, leaves a blocked row with the reason, and tells the model it is blocked", async () => {
    world.planner = [[{ name: "delete_project", args: { project_id: "p1" } }]];
    const body = await (await post({ intent: "Delete the Night Shoot project" })).json();
    expect(toolCalls()).toHaveLength(0);
    expect(body.actions[0]).toMatchObject({ tool_name: "delete_project", status: "rejected", risk_level: "locked", preview_title: "Delete a project" });
    expect(body.actions[0].preview_body).toMatch(/yours to do in the project's settings/);
    expect(body.awaiting_approval).toBe(false);
    expect(actions()).toHaveLength(1);
  });

  it("an old proposal for a tool that is now locked cannot be approved into running", async () => {
    db().seed("orch_actions", [{ id: "11111111-1111-4111-8111-111111111111", user_id: "user-1", tool_name: "delete_project", tool_args: { project_id: "p1" }, status: "proposed", risk_level: "requires_approval" }]);
    const res = await post({ action_id: "11111111-1111-4111-8111-111111111111", decision: "approved" });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/yours to do in the project's settings/);
    expect(actions()[0].status).toBe("proposed");
    expect(toolCalls()).toHaveLength(0);
  });
});

describe("the person's auto-run setting holds inside the planner", () => {
  it("with auto-run off, lookups still resolve names but nothing else runs until approved", async () => {
    db().seed("orch_settings", [{ user_id: "user-1", agents_enabled: true, auto_run_safe: false, daily_action_limit: 50 }]);
    world.planner = [[{ name: "find_user", args: { query: "Lena" } }], [{ name: "create_task", args: { title: "Colour pass" } }]];
    const body = await (await post({ intent: "Add a colour pass task for Lena" })).json();
    expect(toolCalls()).toEqual(["https://legacy.test/functions/v1/copilot-collaborator-tools"]);
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0]).toMatchObject({ tool_name: "create_task", status: "proposed" });
  });

  it("with auto-run on, a safe tool runs once and is recorded as run, never as proposed", async () => {
    world.planner = [[{ name: "create_task", args: { title: "Colour pass" } }]];
    const body = await (await post({ intent: "Add a colour pass task" })).json();
    expect(toolCalls()).toEqual(["https://legacy.test/functions/v1/desk-agent"]);
    expect(body.actions[0]).toMatchObject({ tool_name: "create_task", status: "auto_executed" });
  });
});

describe("failures say what they mean", () => {
  it("a planner-run tool that errors is recorded as not confirmed, and is not run a second time", async () => {
    world.tool = vi.fn(async () => new Response("boom", { status: 500 }));
    world.planner = [[{ name: "create_task", args: { title: "Colour pass" } }]];
    const body = await (await post({ intent: "Add a colour pass task" })).json();
    expect(toolCalls()).toHaveLength(1);
    expect(body.actions[0]).toMatchObject({ status: "failed", result: { outcome: "unknown" } });
    expect(actions()[0].result).toMatchObject({ outcome: "unknown", message: expect.stringMatching(/couldn't confirm/) });
    expect(actions()[0].error).toBe("boom");
  });

  it("approving: a dropped connection is 'not confirmed', a refusal is 'didn't go through'; both are recorded", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    db().seed("orch_actions", [{ id, user_id: "user-1", tool_name: "assign_task", tool_args: { task_id: "t9" }, status: "proposed", risk_level: "requires_approval" }]);
    world.tool = vi.fn(async () => { throw new TypeError("connection reset"); });
    const body = await (await post({ action_id: id, decision: "approved" })).json();
    expect(body).toMatchObject({ ok: false, outcome: "unknown", message: expect.stringMatching(/couldn't confirm whether this went through/) });
    expect(actions()[0]).toMatchObject({ status: "failed", result: { outcome: "unknown" }, error: "connection reset" });
    expect(db().rows("orch_approvals")).toHaveLength(1);

    const id2 = "33333333-3333-4333-8333-333333333333";
    db().seed("orch_actions", [{ id: id2, user_id: "user-1", tool_name: "assign_task", tool_args: { task_id: "t9" }, status: "proposed", risk_level: "requires_approval" }]);
    world.tool = vi.fn(async () => new Response(JSON.stringify({ error: "Not a member" }), { status: 403 }));
    expect(await (await post({ action_id: id2, decision: "approved" })).json()).toMatchObject({ ok: false, outcome: "failed", message: "This didn't go through. Nothing was done." });
  });
});
