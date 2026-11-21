// What happened to a Kreto action, from its recorded status and outcome only (orch_actions.status and result.outcome,
// written by agent-orchestrator). Never inferred: a row with no clear record reads as nothing, not as success.

export interface RecordedOutcome {
  /** "Done", "Didn't go through", "Not confirmed", or null when nothing ran yet. */
  label: string | null;
  /** Stopped by Kreto's policy (locked for agents), which is not the person rejecting it. */
  blocked: boolean;
}

export function recordedOutcome(status: string | null | undefined, result: unknown): RecordedOutcome {
  const outcome = result && typeof result === "object" ? (result as { outcome?: unknown }).outcome : undefined;
  if (status === "failed") return { label: outcome === "unknown" ? "Not confirmed" : "Didn't go through", blocked: false };
  if (status === "executed" || status === "auto_executed") return { label: "Done", blocked: false };
  return { label: null, blocked: status === "rejected" && outcome === "blocked" };
}
