// Who vouches for an invoice being paid.
//
// A paid invoice is either provider-confirmed (the Stripe webhook, verified by
// signature, wrote the payment intent that settled it) or self-reported (the
// issuer confirmed it themselves with confirm_invoice_paid_manually). Both are
// legitimate for the issuer's own books; only the first may be shown to other
// people as proof of work.

export interface InvoiceProvenanceFields {
  status?: string | null;
  stripe_payment_intent_id?: string | null;
}

/** Paid, and a provider reference vouches for it. */
export function isProviderConfirmedPaid(inv: InvoiceProvenanceFields): boolean {
  return (
    typeof inv.status === "string" &&
    inv.status.trim().toLowerCase() === "paid" &&
    typeof inv.stripe_payment_intent_id === "string" &&
    inv.stripe_payment_intent_id.trim().length > 0
  );
}

/** Paid, and nothing but the issuer's own word says so. */
export function isSelfReportedPaid(inv: InvoiceProvenanceFields): boolean {
  return typeof inv.status === "string" && inv.status.trim().toLowerCase() === "paid" && !isProviderConfirmedPaid(inv);
}

export interface PaidNote {
  /** Shown after "Paid". */
  short: string;
  /** The full sentence, for a tooltip or a screen reader. */
  detail: string;
}

/**
 * How to label a paid invoice the issuer recorded themselves, for the person looking at it: the issuer is reminded it is
 * their own record; anyone else is told whose word it is. Null when a payment provider confirmed it, or it is not paid.
 * Before 20261015100000 is applied no invoice carries a provider reference, so every paid invoice reads as recorded by the
 * issuer — which is what production records today, since the webhook cannot mark one paid without that column.
 */
export function paidProvenanceNote(
  inv: InvoiceProvenanceFields & { issued_by?: string | null },
  viewerId: string | null | undefined,
): PaidNote | null {
  if (!isSelfReportedPaid(inv)) return null;
  if (viewerId && inv.issued_by && inv.issued_by === viewerId) {
    return { short: "self-reported", detail: "Marked paid by you; no payment provider confirmed it" };
  }
  return { short: "recorded by the issuer", detail: "Recorded by the issuer; no payment provider confirmed it" };
}
