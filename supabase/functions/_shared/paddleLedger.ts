// The Paddle event ledger (`paddle_webhook_events`): the event id is claimed before an event is processed, and given back when processing
// fails, so Paddle's retry is processed instead of being answered "duplicate".
//
// Deliberately self-contained (no import from webhookLedger.ts): production's copy of that file is an older version that its Stripe
// webhooks depend on, so the Paddle webhook must work without replacing it.
//
//   claimed      this delivery owns the event; release it if it fails
//   duplicate    the event id is already in the ledger (unique violation)
//   unavailable  the ledger could not be written (missing table, no privilege, timeout...): process NOTHING and answer 5xx so Paddle
//                delivers the event again. A plan is never changed without durable de-duplication.

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type PaddleLedgerClaim = "claimed" | "duplicate" | "unavailable";

const TABLE = "paddle_webhook_events";

export async function claimPaddleEvent(db: Db, event: { event_id: string; event_type: string }): Promise<PaddleLedgerClaim> {
  let error: unknown;
  try {
    ({ error } = await db.from(TABLE).insert({ event_id: event.event_id, type: event.event_type, payload: event as unknown as Record<string, unknown> }));
  } catch (e) {
    error = e;
  }
  if (!error) return "claimed";
  if ((error as { code?: unknown } | null)?.code === "23505") return "duplicate";
  console.error("[paddleLedger] ledger unavailable: answering 5xx so Paddle retries", { event_id: event.event_id, code: (error as { code?: unknown } | null)?.code ?? null });
  return "unavailable";
}

/** Gives the event's ledger row back so Paddle's retry is processed. Best effort. */
export async function releasePaddleEvent(db: Db, eventId: string): Promise<boolean> {
  try {
    const { error } = await db.from(TABLE).delete().eq("event_id", eventId);
    return !error;
  } catch (_e) {
    return false;
  }
}
