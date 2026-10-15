// Pure checks for `create-milestone-payment`: may this milestone be paid now, and for how much?
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: the only "already paid" guard was `status === 'paid'`. A milestone whose
// escrow is already held (`escrow_status = 'authorized'`, status `review`) is not
// `paid`, so a second Checkout session could be created for it (the idempotency
// key only collapses an identical request within 24 hours). A second payment for
// a funded milestone is recorded by nobody: the webhook skips an
// already-authorized or already-paid milestone and the money is left unrecorded
// (or held and expiring). The amount, read from the row, was also used unchecked
// (null, zero, negative, fractional cents).

// Stripe enforces its own minimum on the TOTAL (amount + fees), which fails closed; this only
// refuses an amount that is not a positive sum of cents.
export const MIN_MILESTONE_AMOUNT = 0.01;
export const MAX_MILESTONE_AMOUNT = 1_000_000;

export interface PayableMilestone {
  status?: string | null;
  escrow_status?: string | null;
  paid_at?: string | null;
  amount?: unknown;
}

export type PayableCheck =
  | { ok: true; amount: number }
  | { ok: false; status: number; error: string };

export function checkMilestonePayable(m: PayableMilestone): PayableCheck {
  if (m.status === "paid" || m.paid_at || m.escrow_status === "captured") {
    return { ok: false, status: 409, error: "This milestone has already been paid." };
  }
  if (m.escrow_status === "authorized") {
    return { ok: false, status: 409, error: "Funds for this milestone are already held in escrow." };
  }
  const amount = typeof m.amount === "string" ? Number(m.amount) : m.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { ok: false, status: 422, error: "This milestone has no payable amount." };
  }
  const cents = Math.round(amount * 100);
  if (Math.abs(cents / 100 - amount) > 1e-9) {
    return { ok: false, status: 422, error: "This milestone amount must be in whole cents." };
  }
  if (amount < MIN_MILESTONE_AMOUNT || amount > MAX_MILESTONE_AMOUNT) {
    return { ok: false, status: 422, error: "This milestone amount is outside the payable range." };
  }
  return { ok: true, amount: cents / 100 };
}

/** The product name shown on the Checkout page: the milestone's own title, else a clipped client one. */
export function checkoutTitle(dbTitle: unknown, clientTitle: unknown): string {
  const pick = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = pick(dbTitle) || pick(clientTitle);
  return (title || "Milestone").slice(0, 120);
}
