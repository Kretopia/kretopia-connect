// Pure, dependency-free decision helpers for high-stakes Kreto actions.
// Imported by edge functions (Deno) and by the UI (Vite), so it must not
// import anything or touch the network.
//
// Rule (code-only, no schema): an external side effect may run only when the
// orch_actions row belongs to the caller, is exactly 'approved', and has at
// least one orch_approvals record by the caller whose decision is approved /
// edited -- with NO rejected, revoked or cancelled record on the same action.
// Anything else returns a "needs approval" result (and a draft) instead of
// executing. Unknown or missing data is treated as NOT approved (fail closed).
//
// Not covered here (see docs/roadmap/kreto-execution-mvp.md): idempotency
// keys, an outcome_unknown state, timeouts and reconciliation.

export interface GuardAction {
  user_id?: string | null;
  status?: string | null;
  tool_name?: string | null;
}

export interface GuardApproval {
  action_id?: string | null;
  user_id?: string | null;
  decision?: string | null;
}

export type GuardReason =
  | "action_not_found"
  | "wrong_owner"
  | "wrong_tool"
  | "not_approved"
  | "already_executed"
  | "no_approval_record"
  | "approval_revoked";

export type GuardResult =
  | { allowed: true; decision: "approved" | "edited" }
  | { allowed: false; reason: GuardReason; needsApproval: boolean; message: string };

const NEGATIVE = new Set(["rejected", "revoked", "cancelled", "canceled"]);
const POSITIVE = new Set(["approved", "edited"]);
const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

function deny(reason: GuardReason, needsApproval: boolean, message: string): GuardResult {
  return { allowed: false, reason, needsApproval, message };
}

export function evaluateExecutionGuard(input: {
  action: GuardAction | null | undefined;
  approvals: GuardApproval[] | null | undefined;
  /** The authenticated caller; the action and its approval must be theirs. */
  userId: string;
  /** When given, the action's tool_name must match. */
  expectedTool?: string;
  actionId?: string;
}): GuardResult {
  const { action, userId } = input;
  if (!userId || !action) return deny("action_not_found", false, "Referenced agent action not found.");
  if (!action.user_id || action.user_id !== userId) {
    return deny("wrong_owner", false, "Approved action does not belong to this user.");
  }
  if (input.expectedTool && action.tool_name !== input.expectedTool) {
    return deny("wrong_tool", false, "Approved action does not match this request.");
  }

  const status = norm(action.status);
  if (NEGATIVE.has(status)) return deny("approval_revoked", false, `Action is '${status}' -- cannot send.`);
  if (status === "executed" || status === "auto_executed") {
    return deny("already_executed", false, "This action has already run; it cannot be sent again.");
  }
  if (status !== "approved") {
    return deny("not_approved", true, `Action is '${status || "unknown"}', not approved -- needs approval before it can send.`);
  }

  const records = (input.approvals ?? []).filter(
    (a) => !input.actionId || !a.action_id || a.action_id === input.actionId,
  );
  if (records.some((a) => NEGATIVE.has(norm(a.decision)))) {
    return deny("approval_revoked", false, "This action was rejected or revoked -- cannot send.");
  }
  const positive = records.find((a) => POSITIVE.has(norm(a.decision)) && a.user_id === userId);
  if (!positive) {
    return deny("no_approval_record", true, "No approval record by you is linked to this action -- needs approval before it can send.");
  }
  return { allowed: true, decision: norm(positive.decision) as "approved" | "edited" };
}

// ---------------------------------------------------------------------------
// Display helper for the UI: what the recorded run / approval state says.
// It describes records; it does not prove an action is safe to run.
// ---------------------------------------------------------------------------

export type ApprovalTone = "ok" | "waiting" | "blocked" | "unknown";

export interface RunApprovalSummary {
  runLabel: string;
  approvalLabel: string;
  tone: ApprovalTone;
}

const RUN_LABELS: Record<string, string> = {
  pending: "Queued",
  running: "Running",
  awaiting_approval: "Waiting for approval",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function summarizeRunApproval(input: {
  runStatus?: string | null;
  actionStatus?: string | null;
  approvals?: GuardApproval[] | null;
}): RunApprovalSummary {
  const runLabel = RUN_LABELS[norm(input.runStatus)] ?? "Unknown";
  const status = norm(input.actionStatus);
  const decisions = (input.approvals ?? []).map((a) => norm(a.decision));

  if (decisions.some((d) => NEGATIVE.has(d)) || status === "rejected") {
    return { runLabel, approvalLabel: "Rejected", tone: "blocked" };
  }
  if (status === "proposed") return { runLabel, approvalLabel: "Waiting for your approval", tone: "waiting" };
  if (status === "auto_executed") return { runLabel, approvalLabel: "Not needed (safe step)", tone: "ok" };
  if (decisions.includes("edited")) return { runLabel, approvalLabel: "Approved (edited)", tone: "ok" };
  if (decisions.includes("approved")) return { runLabel, approvalLabel: "Approved", tone: "ok" };
  if (status === "approved" || status === "executed" || status === "failed") {
    return { runLabel, approvalLabel: "No approval record", tone: "unknown" };
  }
  return { runLabel, approvalLabel: "Unknown", tone: "unknown" };
}
