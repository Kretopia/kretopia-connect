// Pure, dependency-free freshness check for signed webhooks that carry a unix
// timestamp header (Daily's `x-webhook-timestamp`). Imported by edge functions
// (Deno) and by tests (Vite).
//
// Why: the signature covers `${timestamp}.${body}`, so a captured request stays
// valid forever unless its timestamp is bounded. A bounded window makes a
// replay of an old capture fail even though its signature is genuine.
//
// This is NOT an event ledger: a replay inside the window is still accepted.
// Idempotency of the effects belongs to the handler (and to a Phase 2 table).

/** Default window, seconds. Wider than Stripe's 300 because Daily's retry timing is not documented here. */
export const WEBHOOK_TOLERANCE_SECONDS = 900;

export type WebhookFreshness =
  | { ok: true; ageSeconds: number }
  | { ok: false; reason: "timestamp_invalid" | "timestamp_outside_tolerance" };

/**
 * `header` is the raw header value; `nowSeconds` is injected so the check is
 * deterministic. Seconds are expected; a value that is clearly milliseconds
 * (greater than 1e12) is normalised rather than rejected, so a provider that
 * sends milliseconds does not silently stop working.
 */
export function checkWebhookTimestamp(
  header: string | null | undefined,
  nowSeconds: number,
  toleranceSeconds: number = WEBHOOK_TOLERANCE_SECONDS,
): WebhookFreshness {
  const text = (header ?? "").trim();
  if (!/^\d{1,13}$/.test(text)) return { ok: false, reason: "timestamp_invalid" };
  let ts = Number(text);
  if (!Number.isFinite(ts) || ts <= 0) return { ok: false, reason: "timestamp_invalid" };
  if (ts > 1e12) ts = Math.floor(ts / 1000);
  const age = nowSeconds - ts;
  if (Math.abs(age) > toleranceSeconds) return { ok: false, reason: "timestamp_outside_tolerance" };
  return { ok: true, ageSeconds: age };
}
