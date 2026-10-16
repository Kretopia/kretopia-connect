// The Stripe event ledger (`stripe_webhook_events`), claimed before an event is processed and
// given back when processing fails.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: the webhooks insert the event id into the ledger BEFORE they process the event, so a redelivered
// event is answered 200 and not processed twice. But a handler that then FAILS answers 500 so that Stripe
// retries: the retry carries the same event id, hits the ledger row, gets 200 and is dropped. The failed
// event is never processed: a paid invoice stays unpaid, a purchase has no order, a guest is not credited.
// (The 500 added for an unrecorded invoice payment in the invoice provider reference slice, #187, had
// exactly this hole.)
//
// Rule: a failure that answers non-2xx releases the event's ledger row first, so that Stripe's retry is
// processed. A failure that answers 2xx (an event that cannot be fixed by retrying) keeps its row.

// Minimal structural type of the service-role client, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type LedgerClaim =
  | "claimed" // this delivery owns the event; release it if it fails
  | "duplicate" // the event id is already in the ledger
  | "unrecorded"; // the ledger could not be written (e.g. the table is missing): process anyway, nothing to release

export async function claimWebhookEvent(db: Db, event: { id: string; type: string }): Promise<LedgerClaim> {
  const { error } = await db.from("stripe_webhook_events").insert({
    event_id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });
  if (!error) return "claimed";
  return (error as { code?: string }).code === "23505" ? "duplicate" : "unrecorded";
}

/** Gives the event's ledger row back so Stripe's retry is processed. Best effort: returns false if it could not. */
export async function releaseWebhookEvent(db: Db, eventId: string): Promise<boolean> {
  try {
    const { error } = await db.from("stripe_webhook_events").delete().eq("event_id", eventId);
    return !error;
  } catch (_e) {
    return false;
  }
}
