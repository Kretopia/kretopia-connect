# purchase-event-ticket: one live purchase per buyer, no payment for a cancelled event

Code only: no migration, no policy, no secret, no data change. The price, fee, destination, quantity, Checkout mechanics and the order row are unchanged. Not deployed. The review was the slice named in the previous report ("relire `purchase-event-ticket`"); the fixes below are the parts that were clearly defects, not product choices.

## What was reviewed and is fine
- The price is read server-side from `creative_jams.ticket_price`; the client sends only `eventId`. Quantity is fixed at 1; there is no promo path, so the use-limit race of #190 does not exist here.
- The buyer is the verified token's user; the order, the Checkout session and the payment intent carry the order id, and `verify-event-ticket` confirms with Stripe before granting a seat. With #193 (open at the time of writing) that confirmation also counts a paid order once for these untiered (`tier_id` null) orders.

## Findings (repository evidence)
| # | Where | Evidence | Effect |
|---|---|---|---|
| L1 | `purchase-event-ticket` | the only "already bought" guard was a `jam_participants` row, which `verify-event-ticket` writes **after** payment | two clicks, or two tabs, open two payable Checkout sessions for the same buyer and event; both can be paid and event tickets have no refund flow |
| L2 | same | no `event.status` check (checkout-event-tickets refuses `cancelled`) | a buyer is charged for an event that has been cancelled |
| L3 | same | `req.headers.get("Authorization")!` then `.replace` | a request with no header crashed on a `TypeError` and answered with its message instead of "User not authenticated" |

## What changed
- `_shared/ticketPurchase.ts` (pure, no dependency): `planFromPriorOrders` (a paid order; a purchase created within 120 seconds with no session yet; the buyer's pending sessions, newest first, at most 3) and `classifyTicketSession` (`complete` -> paid, `open` at the same amount and currency with a URL -> reuse, `open` otherwise or `expired` -> recreate, anything else -> unknown).
- `purchase-event-ticket`, before the order is created:
  - a missing Authorization header answers "User not authenticated";
  - a cancelled event is refused;
  - the buyer's earlier `event_orders` for the event (`tier_id` null, `paid` or `pending`) are read; a paid one refuses; a purchase being started right now refuses; an earlier session that is complete refuses ("being confirmed"); one that is **open at the same price is handed back** (same URL, so the buyer pays once); one open at another price is **expired** and a new one is created; a session Stripe cannot be read, or whose state is not understood, refuses and creates nothing.

## Tests
`src/lib/__tests__/ticketPurchase.test.ts` (18). Denied first: a paid order, a purchase starting now, an unreadable date, a completed session of any price, an unknown or empty state, a session at another price, currency or without a URL, bounded and ordered session lookups, statuses that are not part of the plan. Wiring: no `Authorization!`, header checked before the token, cancelled check before any Stripe call, earlier orders read before the order insert and the session create, expire before create, and the price, fee, destination and quantity lines untouched. Not run: against Stripe or a real event.

## Please check
- **The refusals keep the function's existing contract** (status 500 with `{ error }`). The ticket dialog shows its generic error for any non-2xx, so a buyer will not read these messages today; handing back the open session is the case that matters and answers 200 with the same shape as before.
- Two requests that arrive truly together can both read "no earlier order" and both create one: there is no unique index to stop it (adding one is a migration). The 120-second "starting now" rule covers the usual double click; the Checkout sessions of the second are not paid unless the buyer does.
- A superseded open session is expired at Stripe; its order stays `pending` (not rewritten), which is harmless because an expired session cannot be paid.
- A `complete` session that is still settling blocks a new purchase until it resolves, by design.

## Found, not changed
- No `transfers`-capability check as in `checkout-event-tickets`: a host with an account id but no active transfers fails at Stripe (closed) and leaves a pending order.
- The "already has a ticket" guard counts **any** guest-list row, including an `interested` RSVP, so such a person cannot buy. It fails closed; whether it should is a product choice.
- Neither ticket function checks whether the event is private; whoever has the event id can buy. Not verified against how events are listed, so recorded rather than assessed.

## Release and rollback
Paste `_shared/ticketPurchase.ts`, then `purchase-event-ticket`. Rollback: re-paste the previous function; the helper can stay. No frontend change: the dialog opens `data.url`, which may now be the earlier open session's URL.
