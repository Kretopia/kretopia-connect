# wallet-payout and release-escrow: checked requests, and an order moved only from escrow

Code only: no migration, no policy, no grant, no secret, no data change. The Stripe calls, the connected-account scoping, the buyer-only and in-escrow gates, the capture and the notifications are untouched. Not deployed. These are the two outbound-money functions that were still unread after the milestone group (#196, #197).

## What was reviewed and is fine
- **`wallet-payout`** pays out from the caller's **own connected account** (`stripeAccount: wallet.stripe_account_id`, looked up by `user_id`) to its default external account (also looked up by `user_id`); Stripe enforces the available balance. It requires a wallet with `payouts_enabled`. The cash-out sheet sends a stable idempotency key per open. It is not the platform's balance that moves.
- **`release-escrow`** requires the caller to be the order's buyer and the order to be in `escrow` before any Stripe call, and tolerates a capture that already happened.

## Findings (repository evidence; not reproduced against Stripe)
| # | Where | Evidence | Effect |
|---|---|---|---|
| P1 | `wallet-payout` | `amount_cents` only checked truthy and then `Math.round`ed; `currency.toLowerCase()` on whatever was sent; an idempotency key that was not text was replaced by a random one | a string or fraction reaches Stripe; a non-text currency answers as a `TypeError`; a client that asked for retry protection and sent a malformed key silently lost it |
| P2 | `wallet-payout` | the `creator_payouts` insert's error was not read and the response returned `payout: null` as `ok: true` | a real payout with no row, shown as nothing |
| E1 | `release-escrow` | after the capture, the order update had **no condition on status** and its error was not read | a dispute filed in the meantime is overwritten by `completed`; a capture that could not be recorded is reported as success |
| E2 | `release-escrow` | `dispute`: the order was written disputed, **then** `reason.substring(0, 100)` ran; `reason` was not checked to be text and its length was unbounded | a non-text reason leaves the order disputed and answers 500; unbounded text in `dispute_reason` |
| E3 | both | `Authorization!` on `release-escrow` (a `TypeError` for a missing header) | an unclear error |

## What changed
- `_shared/payoutRequest.ts` (pure): `cleanPayoutRequest` (a safe positive integer of cents; a three-letter currency; a text idempotency key of at most 100 characters, refused rather than replaced; method `instant` or `standard`).
- `wallet-payout`: the request is checked before the wallet is read or Stripe is called; a payout that could not be recorded is logged loudly ("PAYOUT CREATED BUT NOT RECORDED") and answered with what Stripe returned, so the cash-out is neither hidden nor repeated.
- `_shared/escrowOrderAction.ts` (pure): `parseEscrowAction` (an order id; `confirm`, or `dispute` with a text reason of 1 to 1000 characters).
- `release-escrow`: the request goes through the check; the confirm and the dispute updates are conditional on `status = 'escrow'` and read their result (a confirm whose record fails says the payment was released but the order could not be updated; a dispute that finds the order no longer in escrow says so); a missing header answers cleanly.

## Tests
`src/lib/__tests__/payoutAndEscrow.test.ts` (20). Denied first: zero, negative, fractional, non-finite, string and huge amounts; non-three-letter or non-text currencies; non-text or over-long keys; missing, non-text or blank dispute reasons; unknown actions; non-object bodies. Wiring: both requests are checked before any lookup or Stripe call; the buyer and in-escrow gates precede the capture; both order updates are conditional and read; the validated reason is the only one used; the connected-account scoping and idempotency fallback are unchanged. Not run: against Stripe or an order.

## Please check
- **A confirm that loses a race after it has captured.** The capture happens before the conditional update (as before). If a dispute lands in that window the order stays disputed while the payment was captured: the function now says so instead of overwriting the dispute, and logs it. Doing the conditional claim **before** the capture and reverting it if the capture fails is the safer order, but it moves payment-state logic and is yours to approve.
- A payout whose row could not be recorded is answered `ok: true` with a payload built from Stripe's response (the screen reads only `error`).

## Found, not changed
- **The takeover path is `wallet-add-bank` plus `wallet-payout`.** A session with the user's token can add a bank account, make it the default and cash out the connected balance to it. I did not read `wallet-add-bank` in this slice; whether adding or changing a payout destination needs a fresh sign-in, a delay or a notification is the control that matters here (`KREPAY_BANK_CONNECTION_SECURITY_REPORT.md` is the earlier report on it).
- `wallet-payout` has no per-day cap of its own (the transfer limits apply to wallet transfers, not to payouts); the connected account's balance is the bound.
- `release-escrow` marks an order `completed` and notifies "has been released to you" when there is no `payment_intent_id`, so an order that was not paid through a held PaymentIntent is completed without moving money. Which payment path produces such an order is not visible in these functions.

## Release and rollback
Paste `_shared/payoutRequest.ts`, then `wallet-payout`; paste `_shared/escrowOrderAction.ts`, then `release-escrow`. No frontend change. Rollback: re-paste the previous functions; the helpers can stay.
