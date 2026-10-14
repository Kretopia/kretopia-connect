// Pure, dependency-light decision for "does this approved agent action cover
// THIS direct message". Imported by edge functions (Deno) and by tests (Vite).
//
// Why: agent-send-dm proved that an approved orch_actions row of the caller
// existed (evaluateExecutionGuard) but never compared the request to what was
// approved. Recipient and text came from the request body, so one approved
// action id could be replayed, within the window before the orchestrator marks
// it executed, for any recipient and any text: "a generic approved status is
// not exact-version approval".
//
// Rule (code-only, no schema; every field already exists on orch_actions and
// orch_approvals):
//   - the existing guard still decides owner, status and approval record;
//   - the approved arguments are exactly what the orchestrator runs: the
//     approving record's `edited_args` when it has one, otherwise the action's
//     `tool_args`;
//   - the recipient and the trimmed text of the request must equal them, per
//     tool: `send_dm` (to_user_id, body) or the `spin_up_project` bundle
//     (creator_user_id, kickoff_message, clipped to 4000 as the bundle does);
//   - any other tool, or approved arguments that name no recipient or no text,
//     is a refusal;
//   - an approval older than 30 minutes is expired: it is acted on the moment
//     it is given, so a late call is a replay, not a send;
//   - one approved action sends at most once: the caller claims the action
//     (status approved -> executed, compare-and-set) before it inserts.
// Anything unknown is denied.

import {
  evaluateExecutionGuard,
  type GuardAction,
  type GuardApproval,
} from "./executionGuard.ts";

export const DM_APPROVAL_MAX_AGE_MS = 30 * 60 * 1000;
const KICKOFF_MAX = 4000;

export interface DmAction extends GuardAction {
  tool_args?: unknown;
  decided_at?: string | null;
}

export interface DmApproval extends GuardApproval {
  id?: string | null;
  edited_args?: unknown;
  decided_at?: string | null;
}

export type DmBindingReason =
  | "action_not_found"
  | "wrong_owner"
  | "wrong_tool"
  | "not_approved"
  | "already_executed"
  | "no_approval_record"
  | "approval_revoked"
  | "unsupported_tool"
  | "approval_missing_target"
  | "recipient_mismatch"
  | "content_mismatch"
  | "approval_time_unknown"
  | "approval_expired";

export type DmBindingResult =
  | { allowed: true; approvalId: string | null; approvedBy: string }
  | { allowed: false; status: 403 | 404 | 409 | 410 | 428; reason: DmBindingReason; message: string };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function deny(status: 403 | 404 | 409 | 410 | 428, reason: DmBindingReason, message: string): DmBindingResult {
  return { allowed: false, status, reason, message };
}

export function bindApprovedDm(input: {
  action: DmAction | null | undefined;
  approvals: DmApproval[] | null | undefined;
  /** The authenticated caller; the action and its approval must be theirs. */
  userId: string;
  actionId: string;
  /** What this request is asking to send. */
  request: { to_user_id: unknown; body: unknown };
  nowMs: number;
}): DmBindingResult {
  const { action, userId, actionId } = input;

  // 1. Owner, status, approval record, revocation: the existing guard.
  const guard = evaluateExecutionGuard({ action, approvals: input.approvals, userId, actionId });
  if (!guard.allowed) {
    const status =
      guard.reason === "action_not_found" ? 404
      : guard.reason === "wrong_owner" || guard.reason === "wrong_tool" ? 403
      : guard.needsApproval ? 428
      : 409;
    return deny(status, guard.reason, guard.message);
  }
  if (!action) return deny(404, "action_not_found", "Referenced agent action not found.");

  // 2. The approving record: the caller's most recent positive decision.
  const positives = (input.approvals ?? [])
    .filter((a) => (!a.action_id || a.action_id === actionId) && a.user_id === userId)
    .filter((a) => {
      const d = typeof a.decision === "string" ? a.decision.trim().toLowerCase() : "";
      return d === "approved" || d === "edited";
    })
    .sort((a, b) => Date.parse(String(b.decided_at ?? "")) - Date.parse(String(a.decided_at ?? "")));
  const approval = positives[0] ?? null;

  // 3. The arguments that were approved: what the orchestrator runs.
  const approvedArgs: unknown = isObject(approval?.edited_args) ? approval!.edited_args : action.tool_args;
  if (!isObject(approvedArgs)) {
    return deny(403, "approval_missing_target", "The approved action names no recipient or message.");
  }

  const tool = typeof action.tool_name === "string" ? action.tool_name.trim() : "";
  let approvedTo: string | null;
  let approvedText: string | null;
  if (tool === "send_dm") {
    approvedTo = str(approvedArgs.to_user_id);
    approvedText = str(approvedArgs.body);
  } else if (tool === "spin_up_project") {
    approvedTo = str(approvedArgs.creator_user_id);
    const kickoff = typeof approvedArgs.kickoff_message === "string" ? approvedArgs.kickoff_message.slice(0, KICKOFF_MAX) : null;
    approvedText = str(kickoff);
  } else {
    return deny(403, "unsupported_tool", "This endpoint sends only approved direct messages.");
  }
  if (!approvedTo || !approvedText) {
    return deny(403, "approval_missing_target", "The approved action names no recipient or message.");
  }

  // 4. Exactly this recipient and exactly this text.
  if (str(input.request.to_user_id) !== approvedTo) {
    return deny(403, "recipient_mismatch", "The approved action is for a different recipient.");
  }
  if (str(input.request.body) !== approvedText) {
    return deny(403, "content_mismatch", "The approved action is for a different message.");
  }

  // 5. Fresh: acted on when given, so a late call is a replay.
  const decidedAt = Date.parse(String(action.decided_at ?? approval?.decided_at ?? ""));
  if (!Number.isFinite(decidedAt)) {
    return deny(403, "approval_time_unknown", "The approval time cannot be established.");
  }
  if (input.nowMs - decidedAt > DM_APPROVAL_MAX_AGE_MS) {
    return deny(410, "approval_expired", "This approval has expired; approve the message again.");
  }

  return { allowed: true, approvalId: approval?.id ?? null, approvedBy: userId };
}
