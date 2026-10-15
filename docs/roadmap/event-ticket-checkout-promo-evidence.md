# checkout-event-tickets: a promo code's use limit holds, and the quantity is a whole number

Code only: no migration, no policy, no secret, no data change. The payment mechanics (Stripe session, application fee, transfer destination, idempotency key, `totalCents`) are unchanged. Not deployed.

The question asked: can a promo code bring a priced ticket to zero, and can a buyer make it? **Only a host-created code can, and only the host can create one** (`event_promo_codes` has a single `FOR ALL` policy, "Hosts manage their promo codes", for `creative_jams.created_by = auth.uid()`). A 100% code, or a fixed code at least the price, is the host's own comp ticket. That is by design and is not changed. What the review found instead is that the **use limit of a code could be exceeded**.

## Findings (repository evidence)
| # | Where | Evidence | Effect |
|---|---|---|---|
| T1 | `checkout-event-tickets` | `promo.uses_count >= promo.max_uses` is a plain read; the use was added later (`increment_promo_use` after the grant for a free ticket, in `verify-event-ticket` after payment for a paid one) | N concurrent requests for a code with one use left all pass the check: a single-use comp code grants N free tickets, a launch-day discount code is honoured far past its cap |
| T2 | same, free branch | the increment ran **after** the capacity reservation and its error was swallowed (`.catch(() => {})`) | a free grant could be recorded with no use counted at all |
| T3 | same | `quantity < 1 \|\| quantity > 50` only: `1.5` and the string `"2"` pass | defence in depth only: `event_orders.quantity` and `reserve_event_ticket_capacity(_quantity integer)` are integers and Stripe refuses a fractional quantity, so a fraction fails further down; a numeric string reaches `quantity_sold + quantity` as a string concatenation |
| T4 | same | a `pending` order holds no use until it is paid | 200 buyers opening checkout together are all served by a 20-use code, and all pay the discounted price |

## What changed
- `_shared/ticketCheckout.ts` (pure, no dependency):
  - `cleanQuantity`: a JavaScript number that is an integer from 1 to 50; anything else (fraction, NaN, string, null, object) is `null`.
  - `claimPromoUse`: a compare-and-set on `uses_count` (`UPDATE ... WHERE id = ? AND uses_count = <the value read>`), retried when it loses the race; `claimed`, `exhausted` or `error` (a code that cannot be read or written is not a grant).
  - `releasePromoUse`: gives a claimed use back, also by compare-and-set, never below zero.
  - `promoHasRoom`: redeemed uses plus other buyers' pending orders against `max_uses`; an unreadable pending count is no room.
- `checkout-event-tickets`:
  - the quantity goes through `cleanQuantity` before any lookup;
  - a **free grant takes its promo use atomically before the capacity reservation** and gives it back if the reservation errors or is refused; the old post-grant `increment_promo_use` is gone (it would double count);
  - a **paid checkout** still consumes its use at payment (`verify-event-ticket`, unchanged) but a limited code is now **held** by other buyers' `pending` orders created in the last 30 minutes; the buyer's own pending orders do not hold it against them.

## Tests
`src/lib/__tests__/ticketCheckout.test.ts` (25). Denied first: fractions, zero, negatives, NaN, infinities, 51, `2 ** 53`, numeric strings, null, arrays, booleans; a used-up code writes nothing; an unreadable, vanished or NaN-count code is an error; a failed write takes no use; **10 concurrent claims of the last use: one wins and the count ends at the limit; 25 concurrent claims of a single-use code: one wins; 6 claimers for 3 uses: never more than 3**; release never goes below zero and leaves an unreadable code alone. Wiring: quantity validated before any lookup, claim before the capacity reservation, no second `increment_promo_use`, release on both failure paths, the buyer's own pending orders excluded, the payment mechanics lines untouched. Mutation check: removing the compare-and-set filter makes the three concurrency tests fail. Not run: against Postgres or Stripe (the fake client models the compare-and-set, it is not the database).

## Please check
- **Pending holds are a trade-off.** For 30 minutes, other buyers' unpaid checkouts count against a limited code, so a person who opened checkout and walked away can keep a use from someone else for that long, and several accounts can do it on purpose to a code with few uses. The alternative (no hold) lets a rush exceed the cap, which costs the host money. The window is one constant, `PENDING_ORDER_HOLD_MINUTES`, in `_shared/ticketCheckout.ts`.
- A Stripe Checkout session lives longer than the hold (24 hours by default): a buyer who pays after the hold lapsed is still honoured and counted at payment, so a cap can be exceeded by that late payment.
- A paid order whose checkout fails after the order row is inserted stays `pending` and holds a use for the same 30 minutes. I did not cancel it: a session may exist at Stripe, and an order marked `cancelled` under a payable session is worse.

## Found, not changed (payment-state logic, needs your approval)
- `verify-event-ticket` reads `status !== "paid"` and later writes `paid`, with no compare-and-set. Two verifications of the same order at the same moment (the success page reloaded while a second trigger runs) both reserve capacity and both call `increment_promo_use`: the tier's `quantity_sold` and the code's `uses_count` are counted twice, and the second reservation can be reported as `capacity_exceeded`. The fix is a conditional update of the order (`WHERE status <> 'paid'`) before the counters; it changes the payment confirmation, so it is a proposal, not part of this slice.

## Release and rollback
Paste `_shared/ticketCheckout.ts`, then `checkout-event-tickets`. Nothing else depends on the helper. Rollback: re-paste the previous function; the helper can stay. The frontend needs no change: refusals come back as `{ error }` with status 400, as before. Watch the function logs for "Promo code fully redeemed" after the paste: that message is now also the answer to a buyer who lost a race, which is correct.
