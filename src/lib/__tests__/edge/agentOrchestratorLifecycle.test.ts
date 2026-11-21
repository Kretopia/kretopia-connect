// Runs the real agent-orchestrator through an action's whole life: an approval runs a tool once and only once, a
// dismissal runs nothing, a failed action is never re-run by approving it again, an approval that cannot be recorded runs
// nothing; the person's switches and daily limit hold before any planning; every run leaves its status, and a failure
// marks the run instead of leaving it "running". Refusals come back in Kreto's words.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  planner: [] as Array<Array<{ name: string; args?: Record<string, unknown> }>>,
  plannerCalls: 0,
  plannerStatus: 200,
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

const env: Record<string, string> = { SUPABASE_URL: "https://legacy.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key", LOVABLE_API_KEY: "gateway-key" };
const REGISTRY = [
  // Production checks arguments against args_schema before running (toolArgs.ts, fails closed), so schemas name their fields.
  { tool_name: "assign_task", agent_kind: "project_manager", description: "Assign a task", risk_level: "requires_approval", handler: "desk-agent", args_schema: { type: "object", properties: { task_id: { type: "string" }, assignee_id: { type: "string" } } }, enabled: true },
  { tool_name: "create_task", agent_kind: "project_manager", description: "Create a task", risk_level: "safe_auto", handler: "desk-agent", args_schema: { type: "object", properties: { title: { type: "string" } } }, enabled: true },
  { tool_name: "remove_collaborator", agent_kind: "project_manager", description: "Remove a collaborator", risk_level: "requires_approval", handler: "copilot-collaborator-tools", args_schema: { type: "object", properties: { project_id: { type: "string" }, user_id_to_remove: { type: "string" } } }, enabled: true },
];
const A1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Every outbound call goes through fetch, as in production: the auth server answers resolveCaller, the model gateway answers
// the classifier (first) and then each planner turn with the next scripted list of tool calls, and anything else is a tool.
const USER = { id: "user-1", email: "me@example.com" };
const route = async (url: unknown, init?: RequestInit): Promise<Response> => {
  const u = String(url);
  if (u === "https://legacy.test/auth/v1/user") {
    const token = new Headers(init?.headers).get("Authorization");
    return token === "Bearer user-token" ? new Response(JSON.stringify(USER)) : new Response("{}", { status: 401 });
  }
  if (u === "https://ai.gateway.lovable.dev/v1/chat/completions") return gateway(JSON.parse(String(init?.body)));
  return world.tool(url, init);
};
const gateway = (body: { tools?: unknown }): Response => {
  if (!body.tools) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ agent_kind: "project_manager", reasoning: "test" }) } }] }));
  world.plannerCalls++;
  if (world.plannerStatus !== 200) return new Response("gateway down", { status: world.plannerStatus });
  const calls = (world.planner.shift() ?? []).map((c, i) => ({ id: `c${i}`, function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } }));
  return new Response(JSON.stringify({ choices: [{ message: { content: "", tool_calls: calls } }], usage: { total_tokens: 10 } }));
};

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  vi.stubGlobal("fetch", vi.fn(route));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/agent-orchestrator/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  world.db = new MemoryDb().seed("orch_tool_registry", REGISTRY);
  world.planner = [];
  world.plannerCalls = 0;
  world.plannerStatus = 200;
  world.tool = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
});

const post = (body: Record<string, unknown>) =>
  world.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
const db = () => world.db as MemoryDb;
const proposed = (status = "proposed") => db().seed("orch_actions", [{ id: A1, user_id: "user-1", tool_name: "assign_task", tool_args: { task_id: "t9" }, status, risk_level: "requires_approval" }]);
const action = () => db().rows("orch_actions").find((a) => a.id === A1)!;

describe("approvals: a tool runs once, only when approved, and never again after a failure", () => {
  it("approving twice (a double tap, a retry) runs the tool once; the second answer says nothing ran twice", async () => {
    proposed();
    const first = await (await post({ action_id: A1, decision: "approved" })).json();
    expect(first.ok).toBe(true);
    const second = await post({ action_id: A1, decision: "approved" });
    expect(second.status).toBe(400);
    expect((await second.json()).message).toBe("This was already decided, so nothing ran twice.");
    expect(world.tool).toHaveBeenCalledTimes(1);
    expect(action().status).toBe("executed");
    expect(db().rows("orch_approvals")).toEqual([expect.objectContaining({ action_id: A1, user_id: "user-1", decision: "approved" })]);
  });

  it("dismissing runs nothing and is recorded", async () => {
    proposed();
    expect(await (await post({ action_id: A1, decision: "rejected" })).json()).toEqual({ ok: true, status: "rejected" });
    expect(world.tool).not.toHaveBeenCalled();
    expect(action().status).toBe("rejected");
    expect(db().rows("orch_approvals")).toEqual([expect.objectContaining({ decision: "rejected", user_id: "user-1" })]);
  });

  it("a failed action cannot be approved into running again (a send must not double)", async () => {
    proposed("failed");
    const res = await post({ action_id: A1, decision: "approved" });
    expect(res.status).toBe(400);
    expect(world.tool).not.toHaveBeenCalled();
  });

  it("when the approval cannot be recorded, nothing runs and the action can be approved again", async () => {
    proposed();
    db().hooks.failOn = (table, op) => (table === "orch_approvals" && op === "insert" ? { message: "write failed" } : null);
    const res = await post({ action_id: A1, decision: "approved" });
    expect(res.status).toBe(503);
    expect((await res.json()).message).toBe("I couldn't record your approval, so nothing ran. Try again.");
    expect(world.tool).not.toHaveBeenCalled();
    expect(action().status).toBe("proposed");
  });
});

describe("production's safeguards stay: who may act, what may run, and with which arguments", () => {
  it("no verified caller, no action: a missing or publishable-key bearer is refused before any read", async () => {
    const noAuth = await world.handler!(new Request("https://edge.test", { method: "POST", body: JSON.stringify({ intent: "x" }) }));
    expect(noAuth.status).toBe(401);
    const anon = await world.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer anon-key" }, body: JSON.stringify({ intent: "x" }) }));
    expect(anon.status).toBe(401);
    expect(db().log.length).toBe(0);
  });

  it("an approval must carry exactly the proposed arguments: an edit needs a new proposal, and nothing runs", async () => {
    proposed();
    const res = await post({ action_id: A1, decision: "approved", edited_args: { task_id: "t10" } });
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("This changed since it was proposed, so it needs a new proposal before it can run.");
    expect(world.tool).not.toHaveBeenCalled();
    expect(action().status).toBe("proposed");
    expect(db().rows("orch_approvals")).toHaveLength(0);
  });

  it("removing someone stays blocked until a target-bound approval exists (428), and nothing runs", async () => {
    db().seed("orch_actions", [{ id: A1, user_id: "user-1", tool_name: "remove_collaborator", tool_args: { project_id: "p1", user_id_to_remove: "u2" }, status: "proposed", risk_level: "requires_approval" }]);
    const res = await post({ action_id: A1, decision: "approved" });
    expect(res.status).toBe(428);
    expect(world.tool).not.toHaveBeenCalled();
    expect(action().status).toBe("proposed");
  });

  it("arguments the registry's schema does not allow are refused before anything is sent, and read 'didn't go through'", async () => {
    db().seed("orch_actions", [{ id: A1, user_id: "user-1", tool_name: "assign_task", tool_args: { task_id: "t9", _source: "card" }, status: "proposed", risk_level: "requires_approval" }]);
    const body = await (await post({ action_id: A1, decision: "approved" })).json();
    expect(body).toMatchObject({ ok: false, outcome: "failed", message: "This didn't go through. Nothing was done." });
    expect(world.tool).not.toHaveBeenCalled();
    expect(action()).toMatchObject({ status: "failed", error: "Invalid tool arguments", result: { outcome: "failed" } });
  });

  it("the approval claim compares arguments as JSON (an object in eq is refused by the database, so it must not be used)", async () => {
    // What production did: .eq("tool_args", object) is sent as "[object Object]" and Postgres refuses it, so no approval ran.
    const refused = await db().from("orch_actions").update({ status: "approved" }).eq("tool_args", { task_id: "t9" });
    expect(refused.error).toMatchObject({ code: "22P02" });
    proposed();
    const body = await (await post({ action_id: A1, decision: "approved" })).json();
    expect(body.ok).toBe(true);
    expect(action().status).toBe("executed");
  });
});

describe("usage limits: the person's switch and the daily limit hold before anything is planned", () => {
  it("with Kreto's actions switched off, nothing is planned, recorded or run, and it says how to turn them on", async () => {
    db().seed("orch_settings", [{ user_id: "user-1", agents_enabled: false, auto_run_safe: true, daily_action_limit: 50 }]);
    const res = await post({ intent: "Add a colour pass task" });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe("Kreto actions are off in your settings. Turn them on in Kreto settings to continue.");
    expect(world.plannerCalls).toBe(0);
    expect(db().rows("orch_runs")).toHaveLength(0);
    expect(world.tool).not.toHaveBeenCalled();
  });

  it("at the daily action limit, nothing is planned and it says so in Kreto's words", async () => {
    db().seed("orch_settings", [{ user_id: "user-1", agents_enabled: true, auto_run_safe: true, daily_action_limit: 2 }]);
    db().seed("orch_actions", [1, 2].map((i) => ({ id: `old-${i}`, user_id: "user-1", tool_name: "create_task", status: "auto_executed", proposed_at: new Date().toISOString() })));
    const res = await post({ intent: "Add a colour pass task" });
    expect(res.status).toBe(429);
    expect((await res.json()).message).toBe("You've reached 2 Kreto actions in the last 24 hours. Try again later.");
    expect(world.plannerCalls).toBe(0);
  });

  it("yesterday's actions do not count toward today's limit", async () => {
    db().seed("orch_settings", [{ user_id: "user-1", agents_enabled: true, auto_run_safe: true, daily_action_limit: 2 }]);
    db().seed("orch_actions", [1, 2].map((i) => ({ id: `old-${i}`, user_id: "user-1", tool_name: "create_task", status: "auto_executed", proposed_at: new Date(Date.now() - 26 * 3600_000).toISOString() })));
    expect((await post({ intent: "Add a colour pass task" })).status).toBe(200);
  });
});

describe("audit trail: every run leaves its status and every action its run", () => {
  it("a run with an action waiting for approval is recorded as awaiting approval, with what was asked", async () => {
    // Which model, effort and tools a run used is not recorded yet: that needs lot K2 and its code change.
    world.planner = [[{ name: "assign_task", args: { task_id: "t9" } }]];
    const body = await (await post({ intent: "Give the colour pass to Lena" })).json();
    const [run] = db().rows("orch_runs");
    expect(run).toMatchObject({ user_id: "user-1", status: "awaiting_approval", agent_kind: "project_manager", intent_text: "Give the colour pass to Lena" });
    expect(body.actions[0]).toMatchObject({ run_id: run.id, user_id: "user-1", status: "proposed" });
  });

  it("a run whose actions all ran is recorded as completed", async () => {
    world.planner = [[{ name: "create_task", args: { title: "Colour pass" } }]];
    await post({ intent: "Add a colour pass task" });
    expect(db().rows("orch_runs")[0].status).toBe("completed");
    expect(db().rows("orch_actions")[0]).toMatchObject({ status: "auto_executed", run_id: db().rows("orch_runs")[0].id });
  });

  it("a failure mid-run marks the run failed (never left running) and tells the person to check before retrying", async () => {
    world.plannerStatus = 500;
    const res = await post({ intent: "Add a colour pass task" });
    expect(res.status).toBe(500);
    expect((await res.json()).message).toBe("Something went wrong while I set that up. Check your recent actions before trying again.");
    expect(db().rows("orch_runs")[0]).toMatchObject({ status: "failed", error: expect.stringMatching(/Planner error: 500/) });
  });
});
