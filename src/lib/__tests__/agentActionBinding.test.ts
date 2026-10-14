import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTION_APPROVAL_MAX_AGE_MS,
  bindApprovedAction,
  type BoundAction,
  type BoundApproval,
} from "../../../supabase/functions/_shared/agentActionBinding";
import { authorizeHighStakesAction } from "../../../supabase/functions/_shared/agentAuthority";

const USER = "user-1";
const OTHER = "user-2";
const ACTION = "action-1";
const PROJECT_A = "project-a";
const PROJECT_B = "project-b";
const PERSON_X = "person-x";
const PERSON_Y = "person-y";
const NOW = Date.parse("2026-10-14T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const deleteAction = (over: Partial<BoundAction> = {}): BoundAction => ({
  user_id: USER,
  status: "approved",
  tool_name: "delete_project",
  tool_args: { project_id: PROJECT_A },
  decided_at: ago(5_000),
  ...over,
});
const removeAction = (over: Partial<BoundAction> = {}): BoundAction => ({
  user_id: USER,
  status: "approved",
  tool_name: "remove_collaborator",
  tool_args: { project_id: PROJECT_A, user_id_to_remove: PERSON_X },
  decided_at: ago(5_000),
  ...over,
});
const approval = (over: Partial<BoundApproval> = {}): BoundApproval => ({
  id: "appr-1",
  action_id: ACTION,
  user_id: USER,
  decision: "approved",
  edited_args: null,
  decided_at: ago(5_000),
  ...over,
});

const projectTarget = (id: unknown) => ({ project: { request: id, approvedKeys: ["project_id", "target_project_id"] } });
const removeTargets = (project: unknown, person: unknown) => ({
  project: { request: project, approvedKeys: ["project_id", "target_project_id"] },
  collaborator: { request: person, approvedKeys: ["user_id_to_remove", "user_id"] },
});

const bindDelete = (over: Partial<Parameters<typeof bindApprovedAction>[0]> = {}) =>
  bindApprovedAction({
    action: deleteAction(),
    approvals: [approval()],
    userId: USER,
    actionId: ACTION,
    toolName: "delete_project",
    targets: projectTarget(PROJECT_A),
    nowMs: NOW,
    ...over,
  });

describe("bindApprovedAction: delete_project", () => {
  it("allows the project that was approved", () => {
    expect(bindDelete()).toEqual({ allowed: true, approvalId: "appr-1" });
  });

  it("refuses another project with the same approved action (the replay this closes)", () => {
    expect(bindDelete({ targets: projectTarget(PROJECT_B) })).toMatchObject({ allowed: false, status: 403, reason: "target_mismatch" });
  });

  it("reads the project from target_project_id too, as the orchestrator may pass it", () => {
    const action = deleteAction({ tool_args: { target_project_id: PROJECT_A } });
    expect(bindDelete({ action })).toMatchObject({ allowed: true });
    expect(bindDelete({ action, targets: projectTarget(PROJECT_B) })).toMatchObject({ allowed: false });
  });

  it("binds to the edited arguments, not the original", () => {
    const edited = approval({ decision: "edited", edited_args: { project_id: PROJECT_B } });
    expect(bindDelete({ approvals: [edited], targets: projectTarget(PROJECT_B) })).toMatchObject({ allowed: true });
    expect(bindDelete({ approvals: [edited], targets: projectTarget(PROJECT_A) })).toMatchObject({ allowed: false, reason: "target_mismatch" });
  });

  it("refuses a missing or empty requested target", () => {
    for (const id of [undefined, null, "", "   ", 42]) {
      expect(bindDelete({ targets: projectTarget(id) })).toMatchObject({ allowed: false, reason: "target_mismatch" });
    }
  });

  it("refuses an approval that names no project", () => {
    expect(bindDelete({ action: deleteAction({ tool_args: {} }) })).toMatchObject({ allowed: false, reason: "approval_missing_target" });
    expect(bindDelete({ action: deleteAction({ tool_args: null }) })).toMatchObject({ allowed: false, reason: "approval_missing_target" });
  });

  it("refuses when the request names no target at all (nothing to bind)", () => {
    expect(bindDelete({ targets: {} })).toMatchObject({ allowed: false, reason: "no_targets" });
  });
});

describe("bindApprovedAction: remove_collaborator", () => {
  const bindRemove = (over: Partial<Parameters<typeof bindApprovedAction>[0]> = {}) =>
    bindApprovedAction({
      action: removeAction(),
      approvals: [approval()],
      userId: USER,
      actionId: ACTION,
      toolName: "remove_collaborator",
      targets: removeTargets(PROJECT_A, PERSON_X),
      nowMs: NOW,
      ...over,
    });

  it("allows exactly this person on exactly this project", () => {
    expect(bindRemove()).toMatchObject({ allowed: true });
  });

  it("refuses another person on the approved project", () => {
    expect(bindRemove({ targets: removeTargets(PROJECT_A, PERSON_Y) })).toMatchObject({ allowed: false, reason: "target_mismatch" });
  });

  it("refuses the approved person on another project", () => {
    expect(bindRemove({ targets: removeTargets(PROJECT_B, PERSON_X) })).toMatchObject({ allowed: false, reason: "target_mismatch" });
  });

  it("refuses an approval that names the project but not the person", () => {
    expect(bindRemove({ action: removeAction({ tool_args: { project_id: PROJECT_A } }) }))
      .toMatchObject({ allowed: false, reason: "approval_missing_target" });
  });
});

describe("bindApprovedAction: actor, tool, status, record, freshness", () => {
  it("refuses another user's action and a different tool", () => {
    expect(bindDelete({ action: deleteAction({ user_id: OTHER }) })).toMatchObject({ allowed: false, status: 403, reason: "wrong_owner" });
    expect(bindDelete({ action: deleteAction({ tool_name: "archive_project" }) })).toMatchObject({ allowed: false, status: 403, reason: "wrong_tool" });
  });

  it("refuses an action that is not approved, already executed, or rejected", () => {
    expect(bindDelete({ action: deleteAction({ status: "proposed" }) })).toMatchObject({ allowed: false, status: 428 });
    expect(bindDelete({ action: deleteAction({ status: "executed" }) })).toMatchObject({ allowed: false, status: 409, reason: "already_executed" });
    expect(bindDelete({ action: deleteAction({ status: "rejected" }) })).toMatchObject({ allowed: false, reason: "approval_revoked" });
  });

  it("refuses an approved status with no approval record: status alone is not an approval", () => {
    expect(bindDelete({ approvals: [] })).toMatchObject({ allowed: false, status: 428, reason: "no_approval_record" });
    expect(bindDelete({ approvals: [approval({ user_id: OTHER })] })).toMatchObject({ allowed: false, reason: "no_approval_record" });
  });

  it("refuses when any record on the action is revoked", () => {
    expect(bindDelete({ approvals: [approval(), approval({ id: "appr-2", decision: "revoked" })] })).toMatchObject({ allowed: false, reason: "approval_revoked" });
  });

  it("refuses an expired approval and an unknown time", () => {
    expect(bindDelete({ action: deleteAction({ decided_at: ago(ACTION_APPROVAL_MAX_AGE_MS + 1000) }) }))
      .toMatchObject({ allowed: false, status: 410, reason: "approval_expired" });
    expect(bindDelete({ action: deleteAction({ decided_at: null }), approvals: [approval({ decided_at: null })] }))
      .toMatchObject({ allowed: false, reason: "approval_time_unknown" });
  });

  it("refuses a missing action", () => {
    expect(bindDelete({ action: null })).toMatchObject({ allowed: false, status: 404, reason: "action_not_found" });
  });
});

// ---- authorizeHighStakesAction over a small in-memory stand-in for the service-role client
interface Row { [k: string]: unknown }
function fakeAdmin(state: { orch_actions: Row[]; orch_approvals: Row[] }, fail: { actions?: boolean; approvals?: boolean; claim?: boolean } = {}) {
  return {
    from(table: "orch_actions" | "orch_approvals") {
      const filters: Array<[string, unknown]> = [];
      let patch: Row | null = null;
      const match = () => state[table].filter((r) => filters.every(([k, v]) => r[k] === v));
      const chain: {
        select: (cols?: string) => typeof chain;
        update: (p: Row) => typeof chain;
        eq: (k: string, v: unknown) => typeof chain;
        maybeSingle: () => Promise<{ data: Row | null; error: { message: string } | null }>;
        then: (resolve: (v: unknown) => unknown) => unknown;
      } = {
        select: () => chain,
        update: (p) => {
          patch = p;
          return chain;
        },
        eq: (k, v) => {
          filters.push([k, v]);
          return chain;
        },
        maybeSingle: async () =>
          (table === "orch_actions" && fail.actions) ? { data: null, error: { message: "boom" } } : { data: match()[0] ?? null, error: null },
        then: (resolve) => {
          if (patch) {
            if (fail.claim) return resolve({ data: null, error: { message: "boom" } });
            const rows = match();
            for (const r of rows) Object.assign(r, patch);
            return resolve({ data: rows.map((r) => ({ id: r.id })), error: null });
          }
          if (table === "orch_approvals" && fail.approvals) return resolve({ data: null, error: { message: "boom" } });
          return resolve({ data: match(), error: null });
        },
      };
      return chain;
    },
  };
}

const freshState = () => ({
  orch_actions: [{ id: ACTION, user_id: USER, status: "approved", tool_name: "delete_project", tool_args: { project_id: PROJECT_A }, decided_at: new Date(Date.now() - 5000).toISOString(), executed_at: null }],
  orch_approvals: [{ id: "appr-1", action_id: ACTION, user_id: USER, decision: "approved", edited_args: null, decided_at: new Date(Date.now() - 5000).toISOString() }],
});

describe("authorizeHighStakesAction", () => {
  const params = (state: ReturnType<typeof freshState>, over: Record<string, unknown> = {}) => ({
    admin: fakeAdmin(state) as never,
    userId: USER,
    toolName: "delete_project",
    source: "agent_orchestrator",
    agentActionId: ACTION,
    targets: projectTarget(PROJECT_A),
    ...over,
  });

  it("authorises the approved project once, then refuses a second use", async () => {
    const state = freshState();
    const first = await authorizeHighStakesAction(params(state));
    expect(first).toMatchObject({ ok: true, source: "agent_orchestrator" });
    expect(state.orch_actions[0].status).toBe("executed");
    const second = await authorizeHighStakesAction(params(state));
    expect(second).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses another project and leaves the action unused", async () => {
    const state = freshState();
    const result = await authorizeHighStakesAction(params(state, { targets: projectTarget(PROJECT_B) }));
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(state.orch_actions[0].status).toBe("approved");
  });

  it("refuses an agent id with no named target: an approval covers what it names", async () => {
    const state = freshState();
    expect(await authorizeHighStakesAction(params(state, { targets: undefined }))).toMatchObject({ ok: false, status: 403 });
    expect(state.orch_actions[0].status).toBe("approved");
  });

  it("refuses an approved status with no approval record", async () => {
    const state = freshState();
    state.orch_approvals = [];
    expect(await authorizeHighStakesAction(params(state))).toMatchObject({ ok: false, status: 428 });
  });

  it("answers 503 and claims nothing when a lookup or the claim failed", async () => {
    const s1 = freshState();
    expect(await authorizeHighStakesAction({ ...params(s1), admin: fakeAdmin(s1, { actions: true }) as never })).toMatchObject({ ok: false, status: 503 });
    const s2 = freshState();
    expect(await authorizeHighStakesAction({ ...params(s2), admin: fakeAdmin(s2, { approvals: true }) as never })).toMatchObject({ ok: false, status: 503 });
    const s3 = freshState();
    expect(await authorizeHighStakesAction({ ...params(s3), admin: fakeAdmin(s3, { claim: true }) as never })).toMatchObject({ ok: false, status: 503 });
    expect(s3.orch_actions[0].status).toBe("approved");
  });

  it("releases the claim when the mutation did not happen", async () => {
    const state = freshState();
    const result = await authorizeHighStakesAction(params(state));
    expect(result.ok).toBe(true);
    if (result.ok) await result.release?.();
    expect(state.orch_actions[0].status).toBe("approved");
  });

  it("still lets a human acting through the app's own UI proceed, and still refuses a desk agent without an approval", async () => {
    const state = freshState();
    expect(await authorizeHighStakesAction({ ...params(state), agentActionId: null, source: "human_ui" })).toMatchObject({ ok: true, source: "human_ui" });
    expect(await authorizeHighStakesAction({ ...params(state), agentActionId: null, source: "desk_agent" })).toMatchObject({ ok: false, status: 428 });
  });
});

describe("send-outreach-draft: an approval covers one draft, for the send_outreach_email tool only", () => {
  const sendAction = (over: Partial<BoundAction> = {}): BoundAction => ({
    user_id: USER,
    status: "approved",
    tool_name: "send_outreach_email",
    tool_args: { draft_id: "draft-1" },
    decided_at: ago(5_000),
    ...over,
  });
  const bindSend = (over: Partial<Parameters<typeof bindApprovedAction>[0]> = {}) =>
    bindApprovedAction({
      action: sendAction(),
      approvals: [approval()],
      userId: USER,
      actionId: ACTION,
      toolName: "send_outreach_email",
      targets: { draft: { request: "draft-1", approvedKeys: ["draft_id"] } },
      nowMs: NOW,
      ...over,
    });

  it("allows the approved draft", () => {
    expect(bindSend()).toMatchObject({ allowed: true });
  });

  it("refuses another draft", () => {
    expect(bindSend({ targets: { draft: { request: "draft-2", approvedKeys: ["draft_id"] } } }))
      .toMatchObject({ allowed: false, reason: "target_mismatch" });
  });

  it("refuses an approved action of another tool: approving a task no longer authorises a send", () => {
    expect(bindSend({ action: sendAction({ tool_name: "create_task", tool_args: { title: "x" } }) }))
      .toMatchObject({ allowed: false, status: 403, reason: "wrong_tool" });
  });

  it("refuses an approved send that names no draft (the old check was skipped here)", () => {
    expect(bindSend({ action: sendAction({ tool_args: {} }) })).toMatchObject({ allowed: false, reason: "approval_missing_target" });
  });

  it("refuses a late, rejected or someone else's approval", () => {
    expect(bindSend({ action: sendAction({ decided_at: ago(ACTION_APPROVAL_MAX_AGE_MS + 1000) }) })).toMatchObject({ allowed: false, status: 410 });
    expect(bindSend({ action: sendAction({ status: "rejected" }) })).toMatchObject({ allowed: false });
    expect(bindSend({ action: sendAction({ user_id: OTHER }) })).toMatchObject({ allowed: false, status: 403 });
  });

  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/send-outreach-draft/index.ts"), "utf8");

  it("is wired: tool-bound, draft required, claimed before the mail leaves, released on failure", () => {
    expect(source).toContain('toolName: "send_outreach_email"');
    expect(source).toContain('targets: { draft: { request: String(draftId), approvedKeys: ["draft_id"] } }');
    expect(source).not.toContain("evaluateExecutionGuard");
    expect(source).not.toContain('typeof approvedDraftId === "string"');
    const claim = source.indexOf('.eq("status", "approved")');
    const sending = source.indexOf('update({ status: "sending" })');
    const smtp = source.indexOf("new SMTPClient(");
    expect(claim).toBeGreaterThan(-1);
    expect(sending).toBeGreaterThan(claim);
    expect(smtp).toBeGreaterThan(claim);
    expect(source).toContain("await releaseClaim?.();");
  });
});

describe("copilot-collaborator-tools wiring", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/copilot-collaborator-tools/index.ts"), "utf8");

  it("names its targets for both irreversible tools and releases the claim on failure", () => {
    expect(source).toContain('targets: {\n      project: { request: projectId, approvedKeys: ["project_id", "target_project_id"] },\n    },');
    expect(source).toContain('collaborator: { request: removeUserId, approvedKeys: ["user_id_to_remove", "user_id"] },');
    expect(source.match(/await authz\.release\?\.\(\);/g)?.length).toBe(2);
  });
});
