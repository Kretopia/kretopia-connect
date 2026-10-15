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
