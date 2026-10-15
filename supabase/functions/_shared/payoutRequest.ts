// Pure request check for `wallet-payout` (a creator cashing out from their own connected account).
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: the request was only checked for truthiness. `amount_cents` was rounded
// with Math.round (a string, a fraction, a huge float all passed to Stripe),
// `currency` was lower-cased without being checked to be text (a TypeError
// answered as the error), and an idempotency key that was not a string was
// silently replaced by a random one (so the retry protection the client asked
// for was off without anyone knowing).

export interface PayoutRequest {
  amountCents: number;
  currency: string; // lower case, three letters
  method: "standard" | "instant";
  idempotencyKey: string | null;
}

export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

export type PayoutRequestCheck =
  | { ok: true; request: PayoutRequest }
  | { ok: false; error: string };

export function cleanPayoutRequest(body: unknown): PayoutRequestCheck {
  const b = (body ?? {}) as Record<string, unknown>;
  const amount = b.amount_cents;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, error: "Invalid amount or currency" };
  }
  const currency = b.currency;
  if (typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency.trim())) {
    return { ok: false, error: "Invalid amount or currency" };
  }
  const key = b.idempotencyKey;
  let idempotencyKey: string | null = null;
  if (key !== undefined && key !== null && key !== "") {
    if (typeof key !== "string" || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      return { ok: false, error: "Invalid idempotency key" };
    }
    idempotencyKey = key;
  }
  return {
    ok: true,
    request: {
      amountCents: amount,
      currency: currency.trim().toLowerCase(),
      method: b.method === "instant" ? "instant" : "standard",
      idempotencyKey,
    },
  };
}
