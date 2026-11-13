// Pure helpers for the doors that run a tool the MODEL chose, or one a person approved (desk-agent, agent-orchestrator,
// copilot-executor, copilot-collaborator-tools). Imported by edge functions (Deno) and by tests (Vite): no network, no env, no SDK.
//
// Why this exists. The handlers behind these doors decide who is calling and what was approved from three request
// fields the CALLER writes: `_tool` (which tool), `_source` (a person or an agent) and `_agent_action_id` (which approval).
// desk-agent built those requests as `{ _tool: name, ...args }` with `args` parsed straight from the model's output, so a
// model that put `_tool` in its arguments chose the tool itself: a `find_user` call could run `add_collaborator`, whose
// handler has no approval check of its own. The rule below is that only server code writes those fields, and it writes
// them last.

/** A field that carries authority (which tool, which caller kind, which approval). Only server code may set it. */
export const isReservedKey = (key: string): boolean => key.startsWith("_");

/** A copy of agent-chosen arguments without any field that carries authority. Anything that is not a plain object becomes `{}`. */
export function stripReservedKeys(args: unknown): Record<string, unknown> {
  if (typeof args !== "object" || args === null || Array.isArray(args)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (!isReservedKey(key)) out[key] = value;
  }
  return out;
}

export interface InternalToolRequest {
  tool: string;
  /** Arguments an agent or a plan chose. Reserved fields in them are dropped. */
  args: unknown;
  /** Who is really calling (`desk_agent`, `agent_orchestrator`): written by the server, never by the arguments. */
  source: string;
  /** The approval this call relies on, if any. */
  agentActionId?: string | null;
  /** Server-computed fields (a resolved project id). Reserved fields in them are dropped too. */
  extra?: Record<string, unknown>;
}

/** The body for an internal call to a tool handler: the arguments first, the authority fields last so nothing can override them. */
export function internalToolBody(input: InternalToolRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { ...stripReservedKeys(input.args), ...stripReservedKeys(input.extra) };
  body._tool = input.tool;
  body._source = input.source;
  if (input.agentActionId) body._agent_action_id = input.agentActionId;
  return body;
}

/**
 * The request fields that name what an approved tool acts on, as groups of alternative spellings (the orchestrator and the
 * desk agent do not spell them alike). An approval for these tools covers exactly these values.
 */
export const TARGET_KEYS: Readonly<Record<string, ReadonlyArray<readonly string[]>>> = {
  delete_project: [["project_id", "target_project_id"]],
  remove_collaborator: [["project_id", "target_project_id"], ["user_id_to_remove", "user_id"]],
  add_collaborator: [["project_id", "target_project_id"], ["user_id_to_add", "user_id"]],
  // Desk tools that reach other people (_shared/deskApproval.ts): an approval may edit the text, not the project.
  send_message_to_collaborator: [["project_id", "target_project_id"]],
  start_video_call: [["project_id", "target_project_id"]],
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function firstValue(args: unknown, keys: readonly string[]): string | null {
  if (typeof args !== "object" || args === null || Array.isArray(args)) return null;
  for (const key of keys) {
    const value = text((args as Record<string, unknown>)[key]);
    if (value) return value;
  }
  return null;
}

export type EditCheck = { ok: true } | { ok: false; field: string };

/**
 * An approval may EDIT the arguments of most tools (the text of a message), but not WHAT a destructive tool acts on:
 * approving "remove Alice" with the person edited to Bob would execute something nobody was shown. For the tools in
 * TARGET_KEYS the edited arguments must name the same value for every target as the proposal did.
 */
export function editedArgsKeepTargets(tool: string, proposed: unknown, edited: unknown): EditCheck {
  const groups = TARGET_KEYS[tool];
  if (!groups || edited === undefined || edited === null) return { ok: true };
  for (const keys of groups) {
    const before = firstValue(proposed, keys);
    const after = firstValue(edited, keys);
    if (before !== after) return { ok: false, field: keys[0] };
  }
  return { ok: true };
}

/** Stable JSON: object keys sorted at every depth, so equal data always gives the same text. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** SHA-256 (hex) of a tool name and its non-reserved arguments: what an approval was shown, in one comparable value. */
export async function fingerprint(tool: string, args: unknown): Promise<string> {
  const data = new TextEncoder().encode(canonicalJson({ tool, args: stripReservedKeys(args) }));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface RegistryTool {
  tool_name?: string | null;
  handler?: string | null;
  risk_level?: string | null;
  enabled?: boolean | null;
}

export type PlanStepCheck =
  | { ok: true; handler: string | null; risk: string }
  | { ok: false; reason: "unknown_tool" | "disabled_tool" | "locked_tool" | "handler_mismatch" | "bad_handler" };

/** A handler name is one path segment of our own functions: letters, digits and dashes. No dots, slashes or colons. */
export const HANDLER_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * A stored plan step names its tool and its handler, but the plan row is data a person can write. The registry decides:
 * the tool must exist and be enabled, must not be locked, and the step's handler must be the registry's own.
 */
export function checkPlanStep(
  step: { tool_name?: unknown; handler?: unknown },
  registry: ReadonlyMap<string, RegistryTool>,
): PlanStepCheck {
  const name = typeof step.tool_name === "string" ? step.tool_name : "";
  const tool = registry.get(name);
  if (!tool) return { ok: false, reason: "unknown_tool" };
  if (tool.enabled === false) return { ok: false, reason: "disabled_tool" };
  if (tool.risk_level === "locked") return { ok: false, reason: "locked_tool" };
  const registered = tool.handler ?? null;
  const claimed = typeof step.handler === "string" && step.handler ? step.handler : null;
  if (claimed !== registered) return { ok: false, reason: "handler_mismatch" };
  if (registered !== null && registered !== "inline" && registered !== "inline_bundle" && !HANDLER_PATTERN.test(registered)) {
    return { ok: false, reason: "bad_handler" };
  }
  return { ok: true, handler: registered, risk: tool.risk_level ?? "safe_auto" };
}
