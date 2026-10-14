// Pure decision for "does this approved agent action cover THIS irreversible
// request". Imported by edge functions (Deno) and by tests (Vite). Generalises
// the binding of _shared/agentDmBinding.ts to any tool whose target is named by
// a few arguments (a project id, a user id).
//
// Why: authorizeHighStakesAction (agentAuthority.ts) accepted any `approved`
// orch_actions row of the caller whose tool_name matched. It never compared
// WHAT the request names with what was approved, never required the approval
// record, and never made the action usable once. So an action approved to delete
// project A could be used to delete project B (any project the caller owns), and
// an action approved to remove one collaborator could remove another, in the
// window before the orchestrator marks it executed.
//
// Rule (code-only, no schema; every field already exists):
//   - the existing guard decides owner, tool, status, approval record and
//     revocation (evaluateExecutionGuard, with expectedTool);
//   - the approved arguments are what the orchestrator runs: the approving
//     record's `edited_args`, otherwise the action's `tool_args`;
//   - every named target of the request equals the approved one (trimmed;
//     nothing else is folded). An approved action that does not name a target
//     covers nothing;
//   - an approval older than 30 minutes is expired: it is acted on when given;
//   - the caller then claims the action approved -> executed by compare-and-set,
//     so one approval is one execution.

import {
  evaluateExecutionGuard,
  type GuardAction,
  type GuardApproval,
} from "./executionGuard.ts";

export const ACTION_APPROVAL_MAX_AGE_MS = 30 * 60 * 1000;

export interface BoundAction extends GuardAction {
  tool_args?: unknown;
  decided_at?: string | null;
}

export interface BoundApproval extends GuardApproval {
  id?: string | null;
  edited_args?: unknown;
  decided_at?: string | null;
}

/** What a request names (`request`) and where the approved action holds it. */
export type TargetSpec = Record<string, { request: unknown; approvedKeys: string[] }>;

export type ActionBindingReason =
  | "action_not_found"
  | "wrong_owner"
  | "wrong_tool"
  | "not_approved"
  | "already_executed"
  | "no_approval_record"
  | "approval_revoked"
  | "no_targets"
  | "approval_missing_target"
  | "target_mismatch"
  | "approval_time_unknown"
  | "approval_expired";

export type ActionBindingResult =
  | { allowed: true; approvalId: string | null }
  | { allowed: false; status: 403 | 404 | 409 | 410 | 428; reason: ActionBindingReason; message: string };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function deny(status: 403 | 404 | 409 | 410 | 428, reason: ActionBindingReason, message: string): ActionBindingResult {
  return { allowed: false, status, reason, message };
}

export function bindApprovedAction(input: {
  action: BoundAction | null | undefined;
  approvals: BoundApproval[] | null | undefined;
  userId: string;
  actionId: string;
  toolName: string;
  targets: TargetSpec;
  nowMs: number;
  maxAgeMs?: number;
}): ActionBindingResult {
  const { action, userId, actionId, toolName } = input;

  const names = Object.keys(input.targets);
  if (names.length === 0) {
    return deny(403, "no_targets", "This action cannot be authorised without naming what it acts on.");
  }

  const guard = evaluateExecutionGuard({
    action,
    approvals: input.approvals,
    userId,
    expectedTool: toolName,
    actionId,
  });
  if (guard.allowed === false) {
    const status =
      guard.reason === "action_not_found" ? 404
      : guard.reason === "wrong_owner" || guard.reason === "wrong_tool" ? 403
      : guard.needsApproval ? 428
      : 409;
    return deny(status, guard.reason, guard.message);
  }
  if (!action) return deny(404, "action_not_found", "Referenced agent action not found.");

  const positives = (input.approvals ?? [])
    .filter((a) => (!a.action_id || a.action_id === actionId) && a.user_id === userId)
    .filter((a) => {
      const d = typeof a.decision === "string" ? a.decision.trim().toLowerCase() : "";
      return d === "approved" || d === "edited";
    })
    .sort((a, b) => Date.parse(String(b.decided_at ?? "")) - Date.parse(String(a.decided_at ?? "")));
  const approval = positives[0] ?? null;

  const approvedArgs: unknown = isObject(approval?.edited_args) ? approval!.edited_args : action.tool_args;
  if (!isObject(approvedArgs)) {
    return deny(403, "approval_missing_target", "The approved action names no target.");
  }

  for (const name of names) {
    const spec = input.targets[name];
    let approved: string | null = null;
    for (const key of spec.approvedKeys) {
      approved = str(approvedArgs[key]);
      if (approved) break;
    }
    if (!approved) {
      return deny(403, "approval_missing_target", `The approved action does not name the ${name}.`);
    }
    if (str(spec.request) !== approved) {
      return deny(403, "target_mismatch", `The approved action is for a different ${name}.`);
    }
  }

  const decidedAt = Date.parse(String(action.decided_at ?? approval?.decided_at ?? ""));
  if (!Number.isFinite(decidedAt)) {
    return deny(403, "approval_time_unknown", "The approval time cannot be established.");
  }
  if (input.nowMs - decidedAt > (input.maxAgeMs ?? ACTION_APPROVAL_MAX_AGE_MS)) {
    return deny(410, "approval_expired", "This approval has expired; approve the action again.");
  }

  return { allowed: true, approvalId: approval?.id ?? null };
}
