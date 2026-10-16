// Pure input checks for the two public pay-link checkouts: `create-invoice-checkout` and
// `create-payment-link-checkout`. Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: both are called with no sign-in (the invoice id or the link slug is the capability), so their
// inputs are whatever an anonymous caller sends.
//  - An invoice with status `cancelled` was still payable by anyone holding its link: only `paid` and
//    quotes were refused, so a cancelled invoice could be paid and then marked paid by the webhook.
//  - The payer's name and note went, unchecked, into Stripe metadata (values are limited to 500
//    characters, non-text values are errors) and into a `payment_link_payments` row: an anonymous caller
//    could make a session fail, or write long text into our table.
//  - The payer's email was put verbatim into the idempotency key (limited to 255 characters) and into
//    `customer_email`.

export const MAX_PAYER_NAME_LENGTH = 120;
export const MAX_PAYER_NOTE_LENGTH = 400;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_SLUG_LENGTH = 100;
export const MIN_CHARGE_CENTS = 50;
export const MAX_CHARGE_CENTS = 99_999_999; // Stripe's own ceiling is 99,999,999 in the smallest unit

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A plausible email, or undefined (the checkout then collects it on Stripe's page). */
export function cleanPayerEmail(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const email = raw.trim();
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email) ? email : undefined;
}

/** Free text for a metadata value and a row: text only, trimmed, clipped, no control characters. */
export function cleanPayerText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  // deno-lint-ignore no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export interface InvoiceForCheckout {
  status?: string | null;
  document_type?: string | null;
  total_amount?: unknown;
}

export type InvoiceCheckoutCheck = { ok: true; cents: number } | { ok: false; error: string };

export function checkInvoicePayable(invoice: InvoiceForCheckout): InvoiceCheckoutCheck {
  if (invoice.document_type === "quote") return { ok: false, error: "Quotes can't be paid" };
  if (invoice.status === "paid") return { ok: false, error: "Invoice already paid" };
  if (invoice.status === "cancelled") return { ok: false, error: "This invoice was cancelled" };
  const total = typeof invoice.total_amount === "string" ? Number(invoice.total_amount) : invoice.total_amount;
  if (typeof total !== "number" || !Number.isFinite(total)) return { ok: false, error: "Invalid amount" };
  const cents = Math.round(total * 100);
  if (cents < MIN_CHARGE_CENTS || cents > MAX_CHARGE_CENTS) return { ok: false, error: "Invalid amount" };
  return { ok: true, cents };
}

export interface PaymentLinkRequest {
  slug: string;
  requestedCents: number | null; // what an open-amount payer asked for; the link's own bounds still apply
  payerEmail: string | undefined;
  payerName: string;
  payerNote: string;
}

export type PaymentLinkRequestCheck = { ok: true; request: PaymentLinkRequest } | { ok: false; error: string };

export function cleanPaymentLinkRequest(body: unknown): PaymentLinkRequestCheck {
  const b = (body ?? {}) as Record<string, unknown>;
  const slug = typeof b.slug === "string" ? b.slug.trim() : "";
  if (!slug || slug.length > MAX_SLUG_LENGTH) return { ok: false, error: "slug required" };

  // An amount that is not a finite number is "no amount": a fixed-amount link ignores it, an open
  // link answers "Amount required" as before.
  let requestedCents: number | null = null;
  if (b.amount_cents !== undefined && b.amount_cents !== null) {
    const n = typeof b.amount_cents === "string" ? Number(b.amount_cents) : b.amount_cents;
    if (typeof n === "number" && Number.isFinite(n)) requestedCents = n;
  }
  return {
    ok: true,
    request: {
      slug,
      requestedCents,
      payerEmail: cleanPayerEmail(b.payer_email),
      payerName: cleanPayerText(b.payer_name, MAX_PAYER_NAME_LENGTH),
      payerNote: cleanPayerText(b.payer_note, MAX_PAYER_NOTE_LENGTH),
    },
  };
}
