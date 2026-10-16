# create-invoice-checkout and create-payment-link-checkout: a cancelled invoice is not payable, and an anonymous payer's text is bounded

Code only: no migration, no policy, no grant, no secret, no data change. The Stripe session, the destination charge and its readiness checks, the amounts, the link's own limits, the idempotency keys, the pending payment row and the webhook that settles them are untouched. Not deployed. These are the last two unread Checkout creators of the money path named in `paid-state-writers-map.md` (#183); both are public (the invoice id or the link slug is the capability), so their input is whatever an anonymous caller sends.

## What was reviewed and is fine
- The amount of an invoice comes from the row, never from the request; an open-amount payment link is bounded by the link's own `min_amount_cents` / `max_amount_cents`; the payer cannot choose a destination.
- A destination charge is attempted only after Stripe confirms the issuer's `transfers` capability is active (the stored `payouts_enabled` flag alone is not trusted).
- `invoice-pay-info` is public by capability (the invoice id) and returns the issuer's IBAN so the payer can pay by transfer: that is its purpose, not a leak. The id is a UUID.

## Findings (repository evidence; not reproduced against Stripe)
| # | Where | Evidence | Effect |
|---|---|---|---|
| I1 | `create-invoice-checkout` | only `paid` and quotes were refused; `invoices.status` is `draft`, `sent`, `paid`, `cancelled`, `overdue` or `accepted` | an invoice the issuer **cancelled** could still be paid by whoever held its link, and the webhook then marked it `paid` |
| I2 | `create-payment-link-checkout` | `payer_name` and `payer_note` (any JSON value) went into Stripe metadata (500-character values, text only) and into a `payment_link_payments` row; `payer_email` went verbatim into `customer_email` and into the idempotency key (255 characters) | an anonymous caller can make a session fail, or write long text and non-text values into our table |
| I3 | both | the body was destructured as sent; a non-object body or a non-text id answered with a `TypeError` message | unclear errors |

## What changed
- `_shared/publicCheckoutInput.ts` (pure, no dependency): `checkInvoicePayable` (quote, paid and **cancelled** refused with their messages; the amount must be a charge between 50 cents and Stripe's ceiling), `cleanPayerEmail` (a plausible email or nothing: the payer then types it on Stripe's page), `cleanPayerText` (text only, control characters removed, clipped), `cleanPaymentLinkRequest` (slug, amount, payer details).
- `create-invoice-checkout`: the invoice is checked before the wallet is read or Stripe is called.
- `create-payment-link-checkout`: the request is cleaned before any lookup; a garbage amount is "no amount" (a fixed link ignores it, an open link answers "Amount required" as before).

## Tests
`src/lib/__tests__/publicCheckoutInput.test.ts` (18). Denied first: a cancelled, paid or quote invoice; a missing, zero, negative, sub-50-cent, non-numeric or above-ceiling amount; implausible, over-long and non-text emails; non-text payer fields; a missing, non-text or over-long slug; non-object bodies. Wiring: the invoice check precedes the wallet read and the session; the link request is cleaned first; the link's own bounds, the destination charge, the readiness check, the idempotency key and the pending row stay. Not run: against Stripe.

## Please check
- **`draft` invoices are still payable.** A draft is editable and may change after a payer opens a session; whether a draft should be payable (an issuer may share the link before "sending") is a product decision I did not make.
- A cancelled invoice that was **already paid** is still refused as paid; a refund of it is a manual matter.

## Found, not changed
- **Where the money goes when the issuer has no connected account.** Both functions create a plain charge on the platform account when the issuer has no `stripe_account_id`, and the webhook then marks the invoice or payment `paid`: the issuer sees "paid" while the funds sit with the platform. This is the same open question as for milestones (#196, #197): who pays the creator and where is it recorded? Refusing the checkout for such issuers is a payment-policy change for you to decide.
- The destination charges set no `application_fee_amount`: the platform takes no fee on invoice or link payments (the comment in the link function mentions a 5% fee "settled by webhook later", which this code does not do). A finance decision.
- `payment_links.single_use` / `max_uses` are counted when a payment is **recorded**, not when a session opens: several anonymous visitors can all open and pay a single-use link at once. Holding the link for open sessions would let anyone block it by opening sessions; left as is.
- An invoice confirmed paid by hand while a Stripe session for it is still open can still be paid in that session.
- No rate limit on anonymous session creation (each call creates a Stripe session and, for links, a pending row).

## Release and rollback
Paste `_shared/publicCheckoutInput.ts`, then `create-invoice-checkout` and `create-payment-link-checkout`. No frontend change. Rollback: re-paste the previous functions; the helper can stay.
