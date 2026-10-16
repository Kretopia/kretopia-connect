# Stripe webhooks: a failed event is retried, not dropped as "already seen"

Code only: no migration, no policy, no grant, no secret, no data change. The signature, mode and paid checks, the per-kind handling, the amounts and every write a handler makes on success are untouched. Not deployed. This corrects a hole in an earlier slice of this program (#187), described below.

## Finding (repository evidence; not reproduced against Stripe)
`stripe-marketplace-webhook` and `stripe-wallet-webhook` write the event id into `stripe_webhook_events` **before** they process the event, so a redelivered event is answered 200 and is not processed twice. But a handler that then **fails** answers 500 so that Stripe retries, and the retry carries the same event id: it hits the ledger row, is answered 200 and is **dropped**. The failed event is never processed.

| # | Where | Evidence | Effect |
|---|---|---|---|
| L1 | `stripe-marketplace-webhook` | three non-2xx answers (the invoice payment that could not be recorded, "Failed to create order", the outer catch) all leave the ledger row in place | a paid invoice stays unpaid, a purchase has no order, an escrow authorisation is not recorded, and Stripe's retry is answered 200. **The 500 added for an unrecorded invoice payment in #187 ("so Stripe retries") did not do what its evidence document said**: the retry was dropped by the ledger. This change makes it true |
| L2 | `stripe-wallet-webhook` | the handler's `catch` only logs and the function always answers `ok`; the `creator_wallets` and `creator_payouts` updates did not read their error | a status that could not be written (`payouts_enabled`, a payout's status, `kyc_status`) is permanent: Stripe is told the event succeeded. A stale `payouts_enabled` lets a cash-out be attempted (or blocks one) on out-of-date information |

`guest-wallet-webhook` has the same pattern and is fixed in #201.

## What changed
- `_shared/webhookLedger.ts` (pure): `claimWebhookEvent` (`claimed`, `duplicate` on a unique-key conflict, or `unrecorded` when the ledger cannot be written, in which case the event is still processed as before) and `releaseWebhookEvent` (gives the row back; best effort, never throws).
- `stripe-marketplace-webhook`: the ledger is claimed through the helper; **a delivery that owns the event gives the row back before each non-2xx answer a retry can fix**: the unrecorded invoice payment, the order that could not be created, and the outer catch. A product that does not exist (404) keeps its row: a retry cannot fix it.
- `stripe-wallet-webhook`: the two status updates read their error and throw; the `catch` gives the row back and answers **500** instead of `ok`.

## Tests
`src/lib/__tests__/webhookLedger.test.ts` (13), plus the two existing suites that read these files (`invoiceProvenance`, `productFilePaths`; the first had a regex window widened by 200 characters). Denied first: a duplicate is not claimed; an unwritable ledger is `unrecorded`, not a block; **a released event is claimed again by the retry, and without the release it is dropped**; releasing one event leaves another; a failing or throwing release reports false. Wiring: signature and mode before the ledger; a duplicate answers 200; the row is given back before the invoice, order and outer-catch 500s but not the 404; the wallet webhook reads its updates, releases and answers 500. Not run: against Stripe.

## Please check
- **A retry now re-runs the whole event.** Most steps are guarded (a paid milestone is skipped, an escrow already authorised is skipped, an order that exists for the payment intent is skipped), but some are not: a payment-link payment increments `payment_links.use_count`, and notifications are inserted again. A failure **after** such a step would repeat it. supabase-js returns database errors instead of throwing, so the paths that reach the outer catch are network or Stripe exceptions, which mostly occur before the writes; I judged that safer than dropping the event, but it is a trade-off.
- A repeated failure means Stripe retries for up to three days with backoff, then stops; the event then needs a person (the Stripe dashboard lists failed deliveries).

## Found, not changed
- **Events dropped before this change are not recovered by it.** Read-only question for whoever has production access: Stripe events of types `checkout.session.completed` whose delivery eventually failed, and the invoices, milestones, orders and payment-link payments they should have produced (an invoice paid in Stripe but still unpaid here is the clearest case). Repairing them is a data change for you to approve.
- The marketplace handler still builds notifications and an auto-invoice inside the same event: splitting them out so a retry cannot repeat them needs a design.

## Release and rollback
Paste `_shared/webhookLedger.ts`, then `stripe-marketplace-webhook` and `stripe-wallet-webhook`. `stripe-marketplace-webhook` is already a bundle step (AA, with the invoice change): its checksum changes. Rollback: re-paste the previous webhooks; the helper can stay.
