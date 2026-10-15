# batch-milestone-payout: the same release rule as the single capture, and no checkout nothing reconciles

Code and one small UI change: no migration, no policy, no grant, no secret, no data change. The single-milestone functions (`create-milestone-payment`, `capture-milestone-payment`), the webhook and the escrow rules are untouched. Not deployed. This is the "Stripe Connect transfer functions other than ..." item of `paid-state-writers-map.md` (#183, section 6), read for the money-moving gate only. The change **removes a path that charges a client**, so it is a payment-logic change: it follows the owner's "Go ahead with the next slice" after the report that named it, and it is easy to revert.

## Findings (repository evidence; not reproduced against Stripe)
| # | Where | Evidence | Effect |
|---|---|---|---|
| B1 | `batch-milestone-payout`, escrow branch | authorises with the project rule only (`projects.client_user_id` or `projects.created_by`) and captures `milestone.payment_intent_id`. `capture-milestone-payment` retrieves the PaymentIntent and, when it records its payer (`userId`, set by `create-milestone-payment`), lets **only that payer** capture or cancel (`assertCanReleaseMilestone`) | the batch door is the weaker one: a project owner who is not the payer (for example the creator who owns the project while the client funded the escrow) could release the client's held funds through the batch while the single capture would refuse them |
| B2 | `batch-milestone-payout`, second branch | for completed milestones with no escrow it creates **one Checkout session on the platform account**, with no destination, no application fee and **no `kind` metadata** (`batch`, `projectId`, `milestoneIds`, `userId` only). `stripe-marketplace-webhook` dispatches on `metadata.kind` and a single `milestoneId`; no other function reads `milestoneIds` or `batch`, and nothing in `src` handles the `payment=success&batch=true` return | the client is charged, no milestone is marked paid, no invoice is made, no creator is paid, and the board still offers the same milestones, so it can be paid again |
| B3 | same, capture loop | the `milestones` update after `paymentIntents.capture` ignored its error and the result said `captured` | money captured, row unchanged, success shown |
| B4 | same | `milestoneIds` and `projectId` used as sent (any type, any length); `Authorization!` crashed on a missing header | type confusion, unbounded `IN` list, a `TypeError` as the answer |

## What changed
- `_shared/batchPayout.ts` (pure, no dependency): `cleanBatchRequest` (text project id; a non-empty list of non-empty text ids, deduplicated, at most 50) and `partitionMilestones` (capturable = escrow `authorized`, intent present, status `review`; not available = completed, `none`, unpaid).
- `batch-milestone-payout`:
  - the request is checked first; a missing Authorization header answers "User not authenticated";
  - the project-level gate stays; **each capture is then bound to the PaymentIntent's recorded payer** through the same `assertCanReleaseMilestone` the single capture uses, and the intent must be `requires_capture`; a refusal is reported for that milestone and nothing is captured for it;
  - a capture whose row update fails is reported as `captured_not_recorded` (and logged), not as success;
  - **the combined Checkout branch is gone**: completed, non-escrow milestones are returned as `not_available` ("Pay this milestone on its own"); they are paid one at a time through `create-milestone-payment`, whose session carries `kind: 'milestone'` and is reconciled by the webhook.
- `MilestoneBoard.tsx`: the batch button counts only escrow that is held and in review and is labelled "Release all"; a batch that had errors says so.

## Tests
`src/lib/__tests__/batchPayout.test.ts` (16). Denied first: missing or non-text project id; empty, non-array or non-text milestone lists; more than 50 ids (after deduplication); a body that is not an object; a completed non-escrow milestone is never capturable; paid, cancelled and half-configured milestones are neither. Wiring: the project gate precedes any milestone read; the payer binding and the `requires_capture` check precede `paymentIntents.capture`; no `checkout.sessions.create` or `customers.list` remains; unrecorded captures are reported; the board offers only held escrow. Not run: against Stripe or a real project.

## Please check
- **A visible behaviour change.** A client who used "Pay All" for completed, non-escrow milestones can no longer do it in one click; they pay each one. That is deliberate, because the combined checkout took the money and recorded nothing. If you want a real combined payment, it needs a design (one session per payee with destinations, or one session with a `kind` and a webhook that settles each milestone), which is payment logic for you to approve.
- A batch whose payer binding fails for one milestone still captures the others it is allowed to.

## Found, not changed
- **Where a creator's milestone money goes after capture is not visible in these functions.** `create-milestone-payment` collects on the platform account (a destination is set only for a manager commission) and neither capture function creates a transfer to the payee: `milestones.paid_to` and the "paid" invoice (whose note says "Talent received 100% of rate") are records. If creators are paid by a separate process (manual Connect payouts, a scheduled job, the wallet), it is outside the repository paths read. This is the most important open question of the payment path: who moves the money to the creator, and where is that recorded?
- A capture that succeeded at Stripe but could not be recorded cannot be repaired by retrying: Stripe refuses a second capture, and the row stays `review`/`authorized`. A repair path (read the intent, find it `succeeded`, record without capturing) is a design for you to approve.
- `create-milestone-payment` accepts `projects.created_by` as an authorised payer, so a creator who owns a project can fund its escrow; the payer binding above is what then limits who can release it.

## Release and rollback
Paste `_shared/batchPayout.ts`, then `batch-milestone-payout` (`_shared/escrowAuth.ts` already exists in `kretopia-app`). Publish the frontend with the next one; either order is safe (an old board talking to the new function simply shows no checkout for non-escrow milestones). Rollback: re-paste the previous function and revert the board change.
