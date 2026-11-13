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
//
// A ledger write that fails is not one case but two:
//   * the ledger itself is broken (missing table or column, no privilege, a value it refuses): every delivery fails the
//     same way, so refusing would stop every payment for the ~3 days Stripe retries and then lose them. The event is
//     processed without duplicate protection and the failure is logged loudly: "unrecorded".
//   * the write failed for a reason a retry may fix (timeout, connection, server error, no error code at all): the
//     event used to be processed anyway, so two overlapping deliveries could both act on it. Now nothing is processed
//     and the webhook answers 5xx, so Stripe delivers it again: "unavailable".

// Minimal structural type of the service-role client, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type LedgerClaim =
  | "claimed" // this delivery owns the event; release it if it fails
  | "duplicate" // the event id is already in the ledger
  | "unrecorded" // the ledger itself is broken (see above): process anyway, nothing to release, logged loudly
  | "unavailable"; // a write a retry may fix failed: process NOTHING and answer 5xx so Stripe delivers it again

/**
 * What a failed ledger insert means. Deterministic errors (PostgreSQL classes 22 data, 23 integrity, 42 schema and
 * privilege; PostgREST's PGRST2xx schema-cache errors) fail every delivery alike; anything else may pass on a retry.
 */
export function classifyLedgerError(error: unknown): Exclude<LedgerClaim, "claimed"> {
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? (error as { code: string }).code : "";
  if (code === "23505") return "duplicate";
  if (/^(22|23|42)[0-9A-Z]{3}$/.test(code) || /^PGRST2\d\d$/.test(code)) return "unrecorded";
  return "unavailable";
}

export async function claimWebhookEvent(db: Db, event: { id: string; type: string }): Promise<LedgerClaim> {
  let error: unknown;
  try {
    ({ error } = await db.from("stripe_webhook_events").insert({
      event_id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    }));
  } catch (e) {
    error = e;
  }
  if (!error) return "claimed";
  const claim = classifyLedgerError(error);
  const code = (error as { code?: unknown } | null)?.code ?? null;
  if (claim === "unrecorded") {
    console.error("[webhookLedger] STRIPE EVENT LEDGER CANNOT BE WRITTEN: processing without duplicate protection", { event_id: event.id, type: event.type, code });
  } else if (claim === "unavailable") {
    console.error("[webhookLedger] event ledger unavailable: answering 5xx so Stripe retries", { event_id: event.id, type: event.type, code });
  }
  return claim;
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
