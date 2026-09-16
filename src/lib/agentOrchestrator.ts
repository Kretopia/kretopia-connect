// Client helper for the agent-orchestrator edge function.
// Single entrypoint to send an intent or approve a previously-proposed action.
import { supabase } from "@/integrations/supabase/client";

export type OrchRiskLevel = "safe_auto" | "requires_approval" | "locked";
export type OrchActionStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "executed"
  | "auto_executed"
  | "failed";

export interface OrchAction {
  id: string;
  run_id: string;
  user_id: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  risk_level: OrchRiskLevel;
  status: OrchActionStatus;
  preview_title: string | null;
  preview_body: string | null;
  persona?: "scout" | "producer" | "archivist" | "deal" | "orchestrator" | null;
  result?: unknown;
  error?: string | null;
}

export interface OrchRunResponse {
  run_id: string;
  status: "running" | "awaiting_approval" | "completed" | "failed";
  agent_kind: string;
  reasoning?: string;
  actions: OrchAction[];
  awaiting_approval: boolean;
}

const ORCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-orchestrator`;

async function callOrchestrator<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Please sign in to use Copilot actions.");

  const resp = await fetch(ORCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }

  if (!resp.ok) {
    const msg = (parsed as { error?: string })?.error || `Orchestrator error (${resp.status})`;
    throw new Error(msg);
  }
  return parsed as T;
}

export async function sendAgentIntent(
  intent: string,
  context: Record<string, unknown> = {},
): Promise<OrchRunResponse> {
  return callOrchestrator<OrchRunResponse>({ intent, context });
}

export async function decideAgentAction(
  actionId: string,
  decision: "approved" | "rejected" | "edited",
  editedArgs?: Record<string, unknown>,
  note?: string,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const res = await callOrchestrator<{ ok: boolean; result?: unknown; error?: string }>({
    action_id: actionId,
    decision,
    edited_args: editedArgs,
    note,
  });
  // Deck instrumentation — fire-and-forget
  import("@/lib/deckMetrics").then(({ trackDeckEvent }) =>
    trackDeckEvent(
      decision === "rejected" ? "agent_action_rejected" : "agent_action_completed",
      "agent",
      { action_id: actionId, decision, ok: res.ok, edited: decision === "edited" },
    ),
  ).catch(() => {});
  return res;
}
