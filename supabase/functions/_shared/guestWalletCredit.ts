// Pure helpers for crediting a guest wallet from a Stripe webhook.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: `guest-wallet-webhook` credited a top-up with a read of `balance_cents`
// followed by an unconditional write of `balance + amount`. Two credits landing
// together lose one of them (the guest paid twice and is credited once). It
// also claimed the top-up `succeeded` BEFORE crediting and, when the credit
// failed, answered 500 while its event ledger row stayed in place: Stripe's
// retry then hit the ledger ("already seen"), got a 200, and the credit was
// never retried. And it did not check that the paid session matches the top-up
// row it credits (amount, currency, wallet).
//
// Rules: a credit is a compare-and-set on `balance_cents` (retried when it
// loses a race); a session must match its row before anything is credited; on
// a failure the claim and the ledger row are given back so the retry can work.

const INT4_MAX = 2_147_483_647; // guest_wallets.balance_cents is integer

// Minimal structural type of the service-role client, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type CreditResult = { ok: true; balance: number } | { ok: false };

export async function creditGuestWallet(db: Db, walletId: string, cents: number, attempts = 6): Promise<CreditResult> {
  if (!Number.isSafeInteger(cents) || cents <= 0) return { ok: false };
  for (let i = 0; i < attempts; i++) {
    const { data: row, error } = await db.from("guest_wallets").select("balance_cents").eq("id", walletId).maybeSingle();
    if (error || !row) return { ok: false };
    const current = Number(row.balance_cents ?? 0);
    if (!Number.isSafeInteger(current) || current < 0) return { ok: false };
    const next = current + cents;
    if (next > INT4_MAX) return { ok: false };

    const { data: won, error: updErr } = await db
      .from("guest_wallets")
      .update({ balance_cents: next })
      .eq("id", walletId)
      .eq("balance_cents", current)
      .select("id");
    if (updErr) return { ok: false };
    if (Array.isArray(won) && won.length > 0) return { ok: true, balance: next };
    // The balance moved between the read and the write: read again.
  }
  return { ok: false };
}

export interface TopupRow {
  id: string;
  wallet_id: string;
  amount_cents: number;
}

export interface PaidSession {
  mode?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
}

/** null when the paid session is the one this top-up row was created for; otherwise why it is not. */
export function guestTopupMismatch(topup: TopupRow, session: PaidSession): string | null {
  if (session.mode !== "payment") return "session is not a one-time payment";
  if (session.amount_total !== topup.amount_cents) return "amount does not match the top-up";
  if (String(session.currency ?? "").toLowerCase() !== "usd") return "currency is not USD";
  if (session.metadata?.topup_id !== topup.id) return "top-up id does not match";
  if (session.metadata?.wallet_id !== topup.wallet_id) return "wallet does not match the top-up";
  return null;
}
