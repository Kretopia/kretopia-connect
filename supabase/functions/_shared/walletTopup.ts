// Pure checks for `wallet-topup` and `wallet-topup-confirm`.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: the wallet has ONE balance (`wallets.balance`, shown as USD everywhere:
// "Available: $x USD"), but `wallet-topup` let the caller choose the currency of
// the Stripe charge and `wallet-topup-confirm` then credited the same NUMBER to
// the balance. A top-up of 10,000 in a cheap currency (a few dollars at Stripe)
// credited 10,000 of balance: the wallet could be minted at any exchange rate,
// and the dialog itself offered TTD (about 6.8 per USD) at face value. The
// confirmation verified the session's amount and metadata, but not its currency.
//
// Rule: a top-up is in the wallet's own currency, USD, until a conversion policy
// exists; the amount is a number of whole cents; the confirmation refuses a
// session or a top-up row in any other currency.

export const WALLET_CURRENCY = "USD";
export const MAX_TOPUP_AMOUNT = 10000;

export type TopupRequest =
  | { ok: true; amount: number; cents: number; gateway: "stripe" | "wipay" }
  | { ok: false; error: string };

export function cleanTopupRequest(body: unknown): TopupRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const amount = b.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Invalid amount" };
  }
  if (amount > MAX_TOPUP_AMOUNT) {
    return { ok: false, error: "Maximum top-up amount is $10,000" };
  }
  const cents = Math.round(amount * 100);
  if (cents < 1 || Math.abs(cents / 100 - amount) > 1e-9) {
    return { ok: false, error: "Amount must be at least 0.01 with at most two decimals" };
  }

  const currency = b.currency;
  if (currency !== undefined && currency !== null) {
    if (typeof currency !== "string" || currency.trim().toUpperCase() !== WALLET_CURRENCY) {
      return { ok: false, error: "Wallet top-ups are in USD only for now" };
    }
  }

  const gateway = b.gateway === undefined || b.gateway === null ? "stripe" : b.gateway;
  if (gateway !== "stripe" && gateway !== "wipay") {
    return { ok: false, error: "Unsupported payment gateway" };
  }
  return { ok: true, amount: cents / 100, cents, gateway };
}

/** Both the top-up row and the Stripe session must be in the wallet's currency. */
export function topupCurrencyMatches(topupCurrency: unknown, sessionCurrency: unknown): boolean {
  const norm = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : "");
  return norm(topupCurrency) === WALLET_CURRENCY && norm(sessionCurrency) === WALLET_CURRENCY;
}
