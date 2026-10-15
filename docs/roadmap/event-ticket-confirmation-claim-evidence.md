# verify-event-ticket: a paid order is counted once

Code only: no migration, no policy, no secret, no data change. The Stripe retrieval and the `paid` requirement, the capacity RPC and its arguments, the overbook flag, the seating upsert and the responses are unchanged. Not deployed. This is the payment-state half that #190 found and left for approval; the owner's "Go ahead with the next slice" (2026-10-15) followed the report that proposed it.

## Finding (repository evidence)
| # | Where | Evidence | Effect |
|---|---|---|---|
| V1 | `verify-event-ticket` | `if (order.status === "paid") return` is a plain read; capacity was reserved (`reserve_event_ticket_capacity`) and the promo use incremented (`increment_promo_use`) **before** the order was written `paid`, and that write's error was not read | two verifications of one order in the same moment both passed the read and both counted: the tier's `quantity_sold` and the code's `uses_count` rose twice for one purchase |
| V2 | callers | `EventPage.tsx:89` and `SessionsSection.tsx:209` both invoke it | the race is reachable in normal use (the success page and the sessions list on the same mount), not only by an attacker |
| V3 | same | a failed write of the order was ignored, the buyer was seated anyway | an order left `pending` with a seated buyer |

A double count is not free money: it makes a tier look sold out early and burns a limited promo code twice. It also made the second reservation able to report a false `capacity_exceeded`.

## What changed
- `_shared/orderConfirmation.ts` (pure, no dependency): `claimOrderPaid` is `UPDATE event_orders SET status = 'paid', ... WHERE id = ? AND status <> 'paid'`; `claimed` means this call made the transition, `already_paid` that another did, `error` that the order could not be written or read back (an order that is gone is never reported paid).
- `verify-event-ticket`: after Stripe confirms the session is paid, the claim comes **first**. Only the caller that gets `claimed` reserves capacity, increments the promo use and seats the buyer; the other answers `{ status: "paid" }` and changes nothing. `error` answers 400 "try again" and seats nobody (Stripe has the payment either way). The overbook flag is a separate small update on the already-paid order.

## Tests
`src/lib/__tests__/orderConfirmation.test.ts` (15). Denied first: an already-paid order is not claimed again and its payment intent is not overwritten; an order that is gone, a failed write and an unreadable order are errors; **ten simultaneous verifications: exactly one claims, nine are `already_paid`; six simultaneous verifications apply the counters once**; another order is unaffected. Wiring: Stripe is asked and must say paid before the claim; the claim is before the capacity RPC and the promo increment; the loser and the error are answered before any counter; `paid` is not written again after the counters; the capacity RPC arguments and the seating are untouched. Mutation check: removing the `status <> 'paid'` guard fails four tests. Not run: against Postgres or Stripe (the fake client models the guarded UPDATE, it is not the database).

## Please check
- **One window moved.** Before, a function dying between the capacity reservation and the `paid` write left the counters applied and the order `pending`, so a retry double counted. Now a function dying between the claim and the reservation leaves the order `paid` with the counters **not** applied (the tier can oversell by that order's quantity). Both are a few milliseconds wide; the new one shows in the logs as an "order claimed paid" line (with the order id) that has no "verified" line after it. If you prefer over-counting to under-counting, the alternative is a counters-applied marker on the order, which needs a column or a metadata convention: say so and I will propose it.
- A `cancelled` order whose Checkout session turns out to be paid is still claimed and counted (as before): a paid session is a paid order.

## Found, not changed
- `verify-event-ticket` requires no signed-in user: whoever has an order id or session id can call it. It can only finalise an order Stripe says is paid, and after this change it is idempotent, so I left it. Requiring the buyer (or the host) is an access change for you to decide.

## Release and rollback
Paste `_shared/orderConfirmation.ts`, then `verify-event-ticket`. Rollback: re-paste the previous function; the helper can stay. No frontend change.
