// Pure input checks for `wallet-transfer`.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why:
//  - The amount was only checked to be truthy and positive. The wallet's
//    balance is numeric(10,2) and `wallet_debit` / `wallet_credit` take an
//    unconstrained numeric, so an amount with a third decimal (0.005) is rounded
//    differently on the two sides: the sender's 10.00 - 0.005 = 9.995 is stored
//    as 10.00 (nothing leaves) and the recipient's 0 + 0.005 is stored as 0.01
//    (a cent appears). Repeated, that creates money. A string or an object also
//    passed the check and reached the database.
//  - `check_transfer_limit` gives every currency label other than TTD the USD
//    limits but sums the sender's past transfers per label. The wallet has one
//    balance (the dialog says "Available: $x USD") and one `wallet_debit`, so a
//    transfer of "EUR 100", "JPY 100" or any other label moves 100 units of the
//    same balance and starts a fresh daily/monthly total: the limits could be
//    passed by changing the label (the dialog offers 13 non-TTD labels, the API
//    accepts any string).
//
// Rules: an amount is a number with at most two decimals, at least 0.01 and at
// most MAX_TRANSFER_AMOUNT; the currency used for the limits and stored with
// the transfer is "TTD" or "USD", whatever else was sent counts as the same
// "USD" bucket the wallet actually moves.

export const MAX_TRANSFER_AMOUNT = 1_000_000;
export const MAX_NOTE_LENGTH = 200;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

export type AmountCheck = { ok: true; amount: number; cents: number } | { ok: false; error: string };

export function cleanTransferAmount(raw: unknown): AmountCheck {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return { ok: false, error: "Missing or invalid recipient/amount" };
  }
  const cents = Math.round(raw * 100);
  if (cents < 1 || Math.abs(cents / 100 - raw) > 1e-9) {
    return { ok: false, error: "Amount must be at least 0.01 and have at most two decimals" };
  }
  if (cents / 100 > MAX_TRANSFER_AMOUNT) {
    return { ok: false, error: "Amount is above the transfer maximum" };
  }
  return { ok: true, amount: cents / 100, cents };
}

/** The bucket the limits and the stored transfer use: "TTD" only when asked, otherwise "USD". */
export function limitCurrency(raw: unknown): "USD" | "TTD" {
  return typeof raw === "string" && raw.trim().toUpperCase() === "TTD" ? "TTD" : "USD";
}

/** A free-text note, trimmed and clipped; anything that is not a string is dropped. */
export function cleanNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const note = raw.trim().slice(0, MAX_NOTE_LENGTH);
  return note || undefined;
}
