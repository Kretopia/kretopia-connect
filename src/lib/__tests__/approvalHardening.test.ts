import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  canonicalJson,
  checkPlanStep,
  editedArgsKeepTargets,
  fingerprint,
  HANDLER_PATTERN,
  internalToolBody,
  stripReservedKeys,
  type RegistryTool,
} from "../../../supabase/functions/_shared/approvalHardening";
import { authorizeHighStakesAction } from "../../../supabase/functions/_shared/agentAuthority";
import { MemoryDb } from "./edge/memoryDb";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

beforeAll(() => {
  // Node 18 has no global WebCrypto in a vitest worker on every setup; the edge runtime always has one.
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
});

describe("stripReservedKeys / internalToolBody: the model never chooses the tool, the caller kind or the approval", () => {
  const injected = { _tool: "delete_project", _source: "human_ui", _agent_action_id: "a-1", __sneaky: 1, name_query: "Alice", _extra: true };

  it("drops every field that starts with an underscore and keeps the data", () => {
    expect(stripReservedKeys(injected)).toEqual({ name_query: "Alice" });
  });

  it("returns an empty object for anything that is not a plain object", () => {
    for (const bad of [null, undefined, "x", 3, ["_tool"], true]) expect(stripReservedKeys(bad)).toEqual({});
  });

  it("writes the authority fields last: a model that sends _tool still runs the tool the server named", () => {
    const body = internalToolBody({ tool: "find_user", args: injected, source: "desk_agent" });
    expect(body._tool).toBe("find_user");
    expect(body._source).toBe("desk_agent");
    expect(body).not.toHaveProperty("_agent_action_id");
    expect(body.name_query).toBe("Alice");
  });

  it("carries the approval id only when the server passes one, and never one from the arguments", () => {
    expect(internalToolBody({ tool: "add_collaborator", args: injected, source: "desk_agent", agentActionId: "real-id" })._agent_action_id).toBe("real-id");
    expect(internalToolBody({ tool: "add_collaborator", args: injected, source: "desk_agent", agentActionId: null })).not.toHaveProperty("_agent_action_id");
    expect(internalToolBody({ tool: "add_collaborator", args: injected, source: "desk_agent", agentActionId: "" })).not.toHaveProperty("_agent_action_id");
  });

  it("drops reserved fields from the server's own extra fields too", () => {
    const body = internalToolBody({ tool: "t", args: {}, extra: { target_project_id: "p", _source: "human_ui" }, source: "desk_agent" });
    expect(body).toMatchObject({ target_project_id: "p", _source: "desk_agent", _tool: "t" });
  });
});

describe("editedArgsKeepTargets: an approval can edit words, not what a destructive tool acts on", () => {
  const proposed = { target_project_id: "P1", user_id_to_remove: "U1", note: "hello" };

  it("accepts an edit that leaves the targets alone", () => {
    expect(editedArgsKeepTargets("remove_collaborator", proposed, { ...proposed, note: "changed" })).toEqual({ ok: true });
  });

  it("refuses another person", () => {
    expect(editedArgsKeepTargets("remove_collaborator", proposed, { ...proposed, user_id_to_remove: "U2" })).toEqual({ ok: false, field: "user_id_to_remove" });
  });

  it("refuses another project", () => {
    expect(editedArgsKeepTargets("remove_collaborator", proposed, { ...proposed, target_project_id: "P2" })).toEqual({ ok: false, field: "project_id" });
  });

  it("refuses an edit that drops a target: the approved action would name nothing to bind", () => {
    expect(editedArgsKeepTargets("remove_collaborator", proposed, { note: "x" }).ok).toBe(false);
    expect(editedArgsKeepTargets("delete_project", { project_id: "P1" }, {}).ok).toBe(false);
  });

  it("treats the alternative spellings of one target as the same target", () => {
    expect(editedArgsKeepTargets("delete_project", { project_id: "P1" }, { target_project_id: "P1" })).toEqual({ ok: true });
    expect(editedArgsKeepTargets("add_collaborator", { project_id: "P1", user_id_to_add: "U1" }, { project_id: "P1", user_id: "U1" })).toEqual({ ok: true });
  });

  it("compares trimmed text, nothing is folded further", () => {
    expect(editedArgsKeepTargets("delete_project", { project_id: "P1" }, { project_id: " P1 " })).toEqual({ ok: true });
    expect(editedArgsKeepTargets("delete_project", { project_id: "P1" }, { project_id: "p1" }).ok).toBe(false);
  });

  it("does not constrain tools without named targets, or an approval with no edit", () => {
    expect(editedArgsKeepTargets("send_dm", { text: "a" }, { text: "b" })).toEqual({ ok: true });
    expect(editedArgsKeepTargets("delete_project", { project_id: "P1" }, undefined)).toEqual({ ok: true });
    expect(editedArgsKeepTargets("delete_project", { project_id: "P1" }, null)).toEqual({ ok: true });
  });
});

describe("canonicalJson / fingerprint: what an approval was shown, in one comparable value", () => {
  it("does not depend on key order, at any depth", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, { y: 2, z: 1 }] }, b: 1 }));
  });

  it("separates different data and different tools", async () => {
    const a = await fingerprint("send_email", { to: "a@x.test", body: "hi" });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprint("send_email", { body: "hi", to: "a@x.test" })).toBe(a);
    expect(await fingerprint("send_email", { to: "a@x.test", body: "hi!" })).not.toBe(a);
    expect(await fingerprint("send_sms", { to: "a@x.test", body: "hi" })).not.toBe(a);
  });

  it("ignores reserved fields: they are not part of what was shown", async () => {
    expect(await fingerprint("t", { a: 1, _agent_action_id: "x" })).toBe(await fingerprint("t", { a: 1 }));
  });
});

describe("checkPlanStep: the registry decides what a stored plan may run", () => {
  const registry = new Map<string, RegistryTool>([
    ["create_task", { tool_name: "create_task", handler: "desk-agent", risk_level: "safe_auto", enabled: true }],
    ["delete_project", { tool_name: "delete_project", handler: "copilot-collaborator-tools", risk_level: "requires_approval", enabled: true }],
    ["charge_card", { tool_name: "charge_card", handler: "create-payment", risk_level: "locked", enabled: true }],
    ["old_tool", { tool_name: "old_tool", handler: "old-fn", risk_level: "safe_auto", enabled: false }],
    ["ask_clarification", { tool_name: "ask_clarification", handler: "inline", risk_level: "safe_auto", enabled: true }],
    ["weird", { tool_name: "weird", handler: "../rest/v1/profiles", risk_level: "safe_auto", enabled: true }],
    ["noop", { tool_name: "noop", handler: null, risk_level: "safe_auto", enabled: true }],
  ]);

  it("accepts a step whose handler is the registry's", () => {
    expect(checkPlanStep({ tool_name: "create_task", handler: "desk-agent" }, registry)).toEqual({ ok: true, handler: "desk-agent", risk: "safe_auto" });
    expect(checkPlanStep({ tool_name: "delete_project", handler: "copilot-collaborator-tools" }, registry)).toMatchObject({ ok: true, risk: "requires_approval" });
    expect(checkPlanStep({ tool_name: "ask_clarification", handler: "inline" }, registry)).toMatchObject({ ok: true });
    expect(checkPlanStep({ tool_name: "noop", handler: null }, registry)).toMatchObject({ ok: true, handler: null });
  });

  it("refuses an unknown, disabled or locked tool", () => {
    expect(checkPlanStep({ tool_name: "nope", handler: "x" }, registry)).toEqual({ ok: false, reason: "unknown_tool" });
    expect(checkPlanStep({ tool_name: undefined, handler: "x" }, registry)).toEqual({ ok: false, reason: "unknown_tool" });
    expect(checkPlanStep({ tool_name: "old_tool", handler: "old-fn" }, registry)).toEqual({ ok: false, reason: "disabled_tool" });
    expect(checkPlanStep({ tool_name: "charge_card", handler: "create-payment" }, registry)).toEqual({ ok: false, reason: "locked_tool" });
  });

  it("refuses a handler the row claims that the registry does not name", () => {
    expect(checkPlanStep({ tool_name: "create_task", handler: "send-outreach-email" }, registry)).toEqual({ ok: false, reason: "handler_mismatch" });
    expect(checkPlanStep({ tool_name: "create_task", handler: "../rest/v1/profiles" }, registry)).toEqual({ ok: false, reason: "handler_mismatch" });
    expect(checkPlanStep({ tool_name: "create_task", handler: null }, registry)).toEqual({ ok: false, reason: "handler_mismatch" });
    expect(checkPlanStep({ tool_name: "noop", handler: "desk-agent" }, registry)).toEqual({ ok: false, reason: "handler_mismatch" });
  });

  it("refuses a registry handler that is not one path segment, even if the row repeats it", () => {
    expect(checkPlanStep({ tool_name: "weird", handler: "../rest/v1/profiles" }, registry)).toEqual({ ok: false, reason: "bad_handler" });
  });

  it("HANDLER_PATTERN accepts our function names and nothing that moves the path", () => {
    for (const ok of ["desk-agent", "send-outreach-draft", "a", "fn2"]) expect(HANDLER_PATTERN.test(ok)).toBe(true);
    for (const bad of ["", "../x", "a/b", "a.b", "A", "-a", "a b", "a?b=1", "a#", "a\\b", "x".repeat(64)]) expect(HANDLER_PATTERN.test(bad)).toBe(false);
  });
});

describe("authorizeHighStakesAction: one approval is one execution, even when two requests arrive together", () => {
  const ACTION = "11111111-1111-4111-8111-111111111111";
  const USER = "user-1";
  const seed = () => {
    const decidedAt = new Date(Date.now() - 5_000).toISOString();
    return new MemoryDb()
      .seed("orch_actions", [{ id: ACTION, user_id: USER, status: "approved", tool_name: "delete_project", tool_args: { project_id: "P1" }, decided_at: decidedAt, executed_at: null }])
      .seed("orch_approvals", [{ id: "ap-1", action_id: ACTION, user_id: USER, decision: "approved", edited_args: null, decided_at: decidedAt }]);
  };
  const call = (db: MemoryDb, over: Record<string, unknown> = {}) =>
    authorizeHighStakesAction({
      admin: db as never,
      userId: USER,
      toolName: "delete_project",
      source: "agent_orchestrator",
      agentActionId: ACTION,
      targets: { project: { request: "P1", approvedKeys: ["project_id", "target_project_id"] } },
      ...over,
    });

  it("lets exactly one of several simultaneous requests through", async () => {
    const db = seed();
    const results = await Promise.all(Array.from({ length: 8 }, () => call(db)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => r.ok === false).every((r) => r.ok === false && r.status === 409)).toBe(true);
    expect(db.rows("orch_actions")[0].status).toBe("executed");
  });

  it("refuses a replay after the execution, and after a release only the released action can run again", async () => {
    const db = seed();
    const first = await call(db);
    expect(first.ok).toBe(true);
    expect(await call(db)).toMatchObject({ ok: false, status: 409 });
    if (first.ok) await first.release?.();
    expect(await call(db)).toMatchObject({ ok: true });
  });

  it("refuses another actor's approval, another target, a different tool and an expired approval without consuming it", async () => {
    const db = seed();
    expect(await call(db, { userId: "intruder" })).toMatchObject({ ok: false });
    expect(await call(db, { targets: { project: { request: "P2", approvedKeys: ["project_id"] } } })).toMatchObject({ ok: false, status: 403 });
    expect(await call(db, { toolName: "remove_collaborator" })).toMatchObject({ ok: false, status: 403 });
    db.rows("orch_actions")[0].decided_at = new Date(Date.now() - 31 * 60_000).toISOString();
    expect(await call(db)).toMatchObject({ ok: false, status: 410 });
    expect(db.rows("orch_actions")[0].status).toBe("approved");
  });

  it("refuses a client-claimed approval: a status with no approval record is not an approval", async () => {
    const db = seed();
    db.tables.orch_approvals = [];
    expect(await call(db)).toMatchObject({ ok: false, status: 428 });
    expect(db.rows("orch_actions")[0].status).toBe("approved");
  });

  it("fails closed, and consumes nothing, when the database cannot answer", async () => {
    const db = seed();
    db.hooks.failOn = (table, op) => (table === "orch_actions" && op === "update" ? { message: "down" } : null);
    expect(await call(db)).toMatchObject({ ok: false, status: 503 });
    expect(db.rows("orch_actions")[0].status).toBe("approved");
  });
});

describe("wiring: the doors that run agent-chosen tools use the shared rules", () => {
  it("desk-agent never lets the model's arguments override the authority fields", () => {
    const src = read("desk-agent/index.ts");
    expect(src).toContain("stripReservedKeys(JSON.parse(");
    expect(src).not.toMatch(/_tool:\s*name,\s*\.\.\.args/);
    expect(src).not.toMatch(/\.\.\.args,\s*_source/);
    expect((src.match(/internalToolBody\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("copilot-collaborator-tools binds add_collaborator to the person and the project, refuses a name fallback, releases on failure", () => {
    const src = read("copilot-collaborator-tools/index.ts");
    const add = src.slice(src.indexOf("async function addCollaborator"), src.indexOf("async function removeCollaborator"));
    expect(add).toContain('toolName: "add_collaborator"');
    expect(add).toContain('approvedKeys: ["user_id_to_add", "user_id"]');
    expect(add.indexOf("resolvedUserId !== newUserId")).toBeGreaterThan(-1);
    expect(add.indexOf("resolvedUserId !== newUserId")).toBeLessThan(add.indexOf("authorizeHighStakesAction("));
    expect(add.indexOf("authorizeHighStakesAction(")).toBeLessThan(add.indexOf('.from("project_collaborators")\n    .insert('));
    expect(add).toContain("await authz.release?.()");
  });

  it("agent-orchestrator refuses a retargeted edit before it claims the action, and records the approval or puts the action back", () => {
    const src = read("agent-orchestrator/index.ts");
    const approval = src.slice(src.indexOf("// ============ APPROVAL PATH"), src.indexOf("// ============ DRAFT OUTREACH BATCH"));
    expect(approval.indexOf("editedArgsKeepTargets(")).toBeGreaterThan(-1);
    expect(approval.indexOf("editedArgsKeepTargets(")).toBeLessThan(approval.indexOf('.eq("status", "proposed")'));
    expect(approval).toContain("stripReservedKeys(edited_args)");
    expect(approval).toContain("approvalErr");
    expect(approval).toMatch(/status: "proposed", decided_at: null/);
  });
});
