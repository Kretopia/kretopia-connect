// Runs the real copilot-executor handler: a plan is claimed once, a decision must be stated, the registry (not the
// stored row) decides what a step may run, and no step can name its own tool, caller kind or approval.
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  sub: "user-1" as string | null,
  fetch: vi.fn(),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, key: string) =>
    key === "anon-key"
      ? { auth: { getClaims: async () => (world.sub ? { data: { claims: { sub: world.sub } }, error: null } : { data: null, error: { message: "bad" } }) } }
      : { from: (table: string) => (world.db as MemoryDb).from(table) },
}));

const env: Record<string, string> = { SUPABASE_URL: "https://backend.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key" };

beforeAll(async () => {
  vi.stubGlobal("Deno", { serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; }, env: { get: (k: string) => env[k] } });
  await import("../../../../supabase/functions/copilot-executor/index.ts");
});

const step = (over: Record<string, unknown> = {}) => ({
  index: 0, tool_name: "create_task", label: "Add a task", rationale: "", args: { title: "Storyboard" },
  agent_kind: "project_manager", handler: "desk-agent", status: "pending", result: null, ...over,
});
const registry = [
  { tool_name: "create_task", handler: "desk-agent", risk_level: "safe_auto", enabled: true },
  { tool_name: "delete_project", handler: "copilot-collaborator-tools", risk_level: "requires_approval", enabled: true },
  { tool_name: "charge_card", handler: "create-payment", risk_level: "locked", enabled: true },
  { tool_name: "old_tool", handler: "old-fn", risk_level: "safe_auto", enabled: false },
];
const seed = (steps: unknown[] = [step()], over: Record<string, unknown> = {}) =>
  new MemoryDb()
    .seed("orch_tool_registry", registry)
    .seed("copilot_plans", [{ id: "plan-1", user_id: "user-1", status: "proposed", project_id: "proj-1", steps, ...over }]);

const call = (body: unknown) =>
  world.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer user-token", Origin: "https://www.kretopia.com" }, body: JSON.stringify(body) }));
const status = (db: MemoryDb) => db.rows("copilot_plans")[0].status;
const sent = () => world.fetch.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(String((init as RequestInit).body)) }));

beforeEach(() => {
  world.sub = "user-1";
  world.fetch.mockReset();
  world.fetch.mockImplementation(async () => new Response(JSON.stringify({ ok: true, result: { project_id: "proj-1" } }), { status: 200 }));
  vi.stubGlobal("fetch", world.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("copilot-executor: a decision is stated, and a plan runs once", () => {
  it("runs nothing when the request states no decision (it used to default to approved)", async () => {
    const db = (world.db = seed()) as MemoryDb;
    for (const body of [{ plan_id: "plan-1" }, { plan_id: "plan-1", decision: "yes" }, { plan_id: "plan-1", decision: true }]) {
      expect((await call(body)).status).toBe(400);
    }
    expect(status(db)).toBe("proposed");
    expect(db.log).toHaveLength(0);
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it("runs a proposed plan once and records the outcome", async () => {
    const db = (world.db = seed()) as MemoryDb;
    const res = await call({ plan_id: "plan-1", decision: "approved" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "completed" });
    expect(status(db)).toBe("completed");
    expect(sent()).toHaveLength(1);
    expect(sent()[0].url).toBe("https://backend.test/functions/v1/desk-agent");
  });

  it("lets exactly one of several simultaneous requests run the steps: no double execution", async () => {
    const db = (world.db = seed([step({ index: 0 }), step({ index: 1, args: { title: "Second" } })])) as MemoryDb;
    const answers = await Promise.all(Array.from({ length: 6 }, () => call({ plan_id: "plan-1", decision: "approved" })));
    const codes = answers.map((a) => a.status).sort();
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(5);
    expect(sent()).toHaveLength(2); // two steps, once
    expect(status(db)).toBe("completed");
  });

  it("refuses to run a plan that already ran or is running, and does not cancel it from underneath", async () => {
    for (const state of ["running", "completed", "failed", "cancelled"]) {
      const db = (world.db = seed([step()], { status: state })) as MemoryDb;
      // The early check answers 400 for a plan already in a final or running state; the 409 is the lost race above.
      expect((await call({ plan_id: "plan-1", decision: "approved" })).status).toBe(400);
      expect((await call({ plan_id: "plan-1", decision: "rejected" })).status).toBe(400);
      expect(status(db)).toBe(state);
      expect(db.writes("copilot_plans")).toHaveLength(0);
    }
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it("does not cancel a plan another request started between the read and the cancel (the rejection is conditional)", async () => {
    const db = (world.db = seed()) as MemoryDb;
    // The plan is 'proposed' when read; a concurrent run claims it before the rejection's UPDATE is applied.
    const original = db.from.bind(db);
    let first = true;
    db.from = ((table: string) => {
      if (table === "copilot_plans" && first) {
        first = false;
        const read = original(table);
        const wrapped = read.select.bind(read);
        read.select = (...a: unknown[]) => {
          const chain = wrapped(...(a as []));
          const single = chain.single.bind(chain);
          chain.single = async () => {
            const result = await single();
            db.rows("copilot_plans")[0].status = "running"; // another request won the claim after this read
            return result;
          };
          return chain;
        };
        return read;
      }
      return original(table);
    }) as typeof db.from;
    expect((await call({ plan_id: "plan-1", decision: "rejected" })).status).toBe(409);
    expect(status(db)).toBe("running");
  });

  it("cancels a proposed plan on a rejection, once", async () => {
    const db = (world.db = seed()) as MemoryDb;
    expect((await call({ plan_id: "plan-1", decision: "rejected" })).status).toBe(200);
    expect(status(db)).toBe("cancelled");
    expect((await call({ plan_id: "plan-1", decision: "rejected" })).status).toBe(400);
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it("does not run a plan of another user, or for a caller with no valid session", async () => {
    const db = (world.db = seed()) as MemoryDb;
    world.sub = "intruder";
    expect((await call({ plan_id: "plan-1", decision: "approved" })).status).toBe(404);
    world.sub = null;
    expect((await call({ plan_id: "plan-1", decision: "approved" })).status).toBe(401);
    expect(status(db)).toBe("proposed");
    expect(world.fetch).not.toHaveBeenCalled();
  });
});

describe("copilot-executor: the registry decides what a step may run", () => {
  const refused = async (steps: unknown[], reason: string) => {
    const db = (world.db = seed(steps)) as MemoryDb;
    const res = await call({ plan_id: "plan-1", decision: "approved" });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ reason });
    // Refused before anything is claimed or run: the plan is untouched and nothing was called.
    expect(status(db)).toBe("proposed");
    expect(db.writes("copilot_plans")).toHaveLength(0);
    expect(world.fetch).not.toHaveBeenCalled();
  };

  it("refuses a locked tool", () => refused([step({ tool_name: "charge_card", handler: "create-payment" })], "locked_tool"));
  it("refuses a disabled tool", () => refused([step({ tool_name: "old_tool", handler: "old-fn" })], "disabled_tool"));
  it("refuses a tool the registry does not know", () => refused([step({ tool_name: "wire_money", handler: "x" })], "unknown_tool"));
  it("refuses a handler the registry does not name, so a row cannot point a step at another function", () =>
    refused([step({ handler: "send-outreach-email" })], "handler_mismatch"));
  it("refuses a handler that would move the request path", () => refused([step({ handler: "../rest/v1/profiles" })], "handler_mismatch"));
  it("refuses the whole plan when one step is refused, even after fine ones", () =>
    refused([step({ index: 0 }), step({ index: 1, tool_name: "charge_card", handler: "create-payment" })], "locked_tool"));

  it("does not check a step the person skipped", async () => {
    const db = (world.db = seed([step({ index: 0 }), step({ index: 1, tool_name: "charge_card", handler: "create-payment" })])) as MemoryDb;
    const res = await call({ plan_id: "plan-1", decision: "approved", skip_indices: [1] });
    expect(res.status).toBe(200);
    expect(sent()).toHaveLength(1);
    expect(status(db)).toBe("completed");
  });

  it("fails closed, running nothing, when the registry cannot be read", async () => {
    const db = (world.db = seed()) as MemoryDb;
    db.hooks.failOn = (table) => (table === "orch_tool_registry" ? { message: "down" } : null);
    expect((await call({ plan_id: "plan-1", decision: "approved" })).status).toBe(503);
    expect(status(db)).toBe("proposed");
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it("fails closed, running nothing, when the plan cannot be claimed", async () => {
    const db = (world.db = seed()) as MemoryDb;
    db.hooks.failOn = (table, op) => (table === "copilot_plans" && op === "update" ? { message: "down" } : null);
    expect((await call({ plan_id: "plan-1", decision: "approved" })).status).toBe(503);
    expect(world.fetch).not.toHaveBeenCalled();
  });
});

describe("copilot-executor: a step cannot name its own tool, caller kind or approval", () => {
  it("overrides every authority field the stored arguments carry", async () => {
    world.db = seed([step({ args: { title: "x", _tool: "delete_project", _source: "human_ui", _agent_action_id: "someone-elses-action" } })]);
    expect((await call({ plan_id: "plan-1", decision: "approved" })).status).toBe(200);
    const [{ body }] = sent();
    expect(body._tool).toBe("create_task");
    expect(body._source).toBe("agent_orchestrator");
    expect(body).not.toHaveProperty("_agent_action_id");
    expect(body.title).toBe("x");
  });
});
