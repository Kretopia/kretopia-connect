// Pure helpers for desk-agent: which of its tools reach other people, when such a tool may run, and what each executed
// tool leaves in the orch_actions ledger. Imported by the edge function (Deno) and by tests (Vite): no network, no env, no SDK.
//
// Why. desk-agent posted an AI-written message into project chat (send_message_to_collaborator) and opened a call room
// whose join link is posted for every member (start_video_call) the moment a model chose to, while the same message tool
// needed approval on the orchestrator path. Every other tool it ran left no per-action record, only a best-effort run receipt.
//
// Rule.
//   * A tool that reaches other people runs only on a call that a door made AFTER the person approved it: the orchestrator
//     executing an approved action (it sends `_agent_action_id`, whose approval desk-agent proves with executionGuard) or
//     the copilot executor running an approved plan (it checks each step against the plan first). Both write `_source`
//     last through internalToolBody / executeAction, and model arguments never carry `_` fields (stripReservedKeys).
//     Anything else, including desk-agent's own model, queues an orch_actions proposal with a preview instead.
//   * Task edits, reminders, drafts and Credits stay immediate: the person's own request names them, and nothing leaves
//     the project. They are recorded instead.
//   * Every tool desk-agent runs on its own authority leaves one orch_actions row. A call that executes an approved action
//     does not: the orchestrator already updates that action's row.

/** Desk tools whose effect reaches people other than the caller. */
export const DESK_OUTWARD_TOOLS: ReadonlySet<string> = new Set(["send_message_to_collaborator", "start_video_call"]);

/** The door that runs approved actions and approved plans writes this `_source`. */
export const APPROVED_DOOR_SOURCE = "agent_orchestrator";

export interface DeskCall {
  /** The tool the model or the caller wants to run. */
  tool: string;
  /** `_tool` of the request: set when a door calls one tool directly, null for desk-agent's own model turn. */
  requestedTool: string | null;
  /** `_source` of the request. */
  source: unknown;
  /** `_agent_action_id` of the request. */
  agentActionId: unknown;
}

export type DeskGate =
  | { run: true; proveAction: string | null }
  | { run: false; queue: true };

/**
 * Whether desk-agent may run this tool now. `proveAction` names the approved action whose approval record must be proven
 * (executionGuard) before the side effect; when the proof fails, nothing runs.
 */
export function deskToolGate(call: DeskCall): DeskGate {
  if (!DESK_OUTWARD_TOOLS.has(call.tool)) return { run: true, proveAction: null };
  const direct = call.requestedTool === call.tool && call.source === APPROVED_DOOR_SOURCE;
  if (!direct) return { run: false, queue: true };
  const actionId = typeof call.agentActionId === "string" && call.agentActionId.trim() ? call.agentActionId.trim() : null;
  return { run: true, proveAction: actionId };
}

/** Registry tiers of desk-agent's tools (orch_tool_registry, with start_video_call re-tiered by 20261113102000). */
export const DESK_TOOL_RISK: Readonly<Record<string, "safe_auto" | "requires_approval">> = {
  create_task: "safe_auto",
  mark_task_done: "safe_auto",
  schedule_reminder: "safe_auto",
  get_project_summary: "safe_auto",
  add_credit: "safe_auto",
  find_user: "safe_auto",
  list_my_projects: "safe_auto",
  ask_clarification: "safe_auto",
  propose_multistep_plan: "safe_auto",
  draft_invoice: "requires_approval",
  draft_quote: "requires_approval",
  send_message_to_collaborator: "requires_approval",
  start_video_call: "requires_approval",
  add_collaborator: "requires_approval",
  remove_collaborator: "requires_approval",
};

export interface DeskExecuted {
  tool: string;
  args: unknown;
  result: unknown;
  ok: boolean;
}

export interface DeskActionRow {
  run_id: string;
  user_id: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  risk_level: "safe_auto" | "requires_approval";
  status: "auto_executed" | "executed" | "failed";
  source: "desk_agent";
  result: Record<string, unknown> | null;
  error: string | null;
  preview_title: string;
  executed_at: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The orch_actions rows for what desk-agent ran in this request. Proposals (they have their own row) are skipped, and so
 * is everything when the call executes an approved action (the orchestrator records it).
 *   * desk-agent's own model turn: `auto_executed`;
 *   * a door's direct call after an approved plan: `executed`;
 *   * any other direct call (the orchestrator's automatic tier records its own row; a person calling a tool themselves is
 *     not an agent action): nothing.
 */
export function deskActionRows(input: {
  runId: string;
  userId: string;
  call: Omit<DeskCall, "tool">;
  actions: ReadonlyArray<DeskExecuted>;
  now?: string;
}): DeskActionRow[] {
  const { call } = input;
  const approvedAction = typeof call.agentActionId === "string" && call.agentActionId.trim() !== "";
  if (approvedAction) return [];
  const status = call.requestedTool === null ? "auto_executed" : call.source === APPROVED_DOOR_SOURCE ? "executed" : null;
  if (!status) return [];
  const at = input.now ?? new Date().toISOString();
  return input.actions
    .filter((a) => !(isObject(a.result) && a.result.needs_approval === true))
    .map((a) => {
      const result = isObject(a.result) ? a.result : a.result === undefined ? null : { value: a.result };
      const error = a.ok ? null : String((isObject(a.result) && a.result.error) || "failed").slice(0, 500);
      return {
        run_id: input.runId,
        user_id: input.userId,
        tool_name: a.tool,
        tool_args: isObject(a.args) ? a.args : {},
        risk_level: DESK_TOOL_RISK[a.tool] ?? "requires_approval",
        status: a.ok ? status : "failed",
        source: "desk_agent",
        result: a.ok ? result : null,
        error,
        preview_title: a.tool,
        executed_at: at,
      };
    });
}
