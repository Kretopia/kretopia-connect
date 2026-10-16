# paid curated stages: the invitation gate applies to a ticket, and a paid buyer is recorded and seated or told to retry

Code only: no migration, no policy, no grant, no secret, no data change. The price, currency, stage status and capacity pre-check, the Stripe session shape, the idempotency key, the RSVP table and its counter trigger are untouched. Not deployed. This reads the stage twin of the event ticket flows fixed in #190 to #194.

## What was reviewed and is fine
The price and currency come from the stage row; the buyer is the signed-in caller; `verify-stage-ticket` retrieves the session at Stripe, requires it paid and requires its `metadata.user_id` to be the caller. `rsvp_count` is recomputed by a trigger from the RSVP rows (`rsvp` and `attended`).
**No screen calls `checkout-stage-ticket` or `verify-stage-ticket` today** (no reference in `src`): the paid stage path is deployed code without a button. That does not make the functions safe, they are callable.

## Findings (repository evidence; not reproduced against Stripe)
| # | Where | Evidence | Effect |
|---|---|---|---|
| S1 | `checkout-stage-ticket` + `verify-stage-ticket` | `rsvp-curated-stage` seats someone in a **private** stage only if they are the host, hold the stage's invite token or are invited by email; the paid path had no such gate. Checkout sold a ticket for any paid stage to anyone who knew its id and verify wrote the RSVP | a private paid stage can be entered by paying, bypassing the invitation |
| S2 | `checkout-stage-ticket` | no check for an existing seat or paid order; the only guard is a Stripe idempotency key that lasts 24 hours | after a day, the same person can buy a second ticket |
| S3 | `checkout-stage-ticket` | the pending order insert was wrapped in `try/catch` around an `await` that does not throw on a database error, so a failure was silent | a paid session with no order row |
| S4 | `verify-stage-ticket` | with no order row the update matched nothing; the RSVP was written with `ticket_order_id: null`; nothing recorded the payment | a paid ticket with no paid order in our table |
| S5 | `verify-stage-ticket` | the RSVP upsert's error was not read and the answer was `paid: true` | a paid buyer with no seat, told they are paid |
| S6 | `verify-stage-ticket` | any paid session of the caller whose metadata carried a `stage_id` was accepted (the session's `kind` was not checked) | defence in depth only: nothing else writes that metadata today |
| S7 | `rsvp-curated-stage` | the invitation-by-email lookup used `ilike` with the visitor's own address as the pattern | an address containing `_` or `%` (`a_b@x.com`) also matched an invitation sent to `aXb@x.com` |

## What changed
- `_shared/stageTicket.ts` (pure, no dependency): `decideStageEntry` (the rule, with no I/O), `canEnterStage` (the rule with its one lookup, fail-closed, with `_` and `%` escaped), `alreadyHasTicket`, `isStageTicketSession`, `entryWasChecked`.
- `checkout-stage-ticket`: the entry rule (**403 `INVITE_REQUIRED`** for a private stage) and "one ticket per person" are applied before any Stripe call; the session records `entry_checked: "1"`; the pending-order error is logged.
- `verify-stage-ticket`: only a session this flow created counts; for a private stage a buyer is seated only if the session says the entry rule was applied, or the buyer is the host or invited by email (otherwise 403 `INVITE_REQUIRED` with `paid: true`: the money was taken and a person must decide); a missing pending order is recorded as a paid order from the session; failures to record the order or the seat answer an error so the client retries.
- `rsvp-curated-stage`: the same entry rule through the shared function (same answers; the `_` / `%` hole closed).

## Tests
`src/lib/__tests__/stageTicket.test.ts` (18). Denied first: a private stage refuses no token, a wrong or empty token, a stage with no token, and a non-host; an invitation that is revoked, absent, for an address that differs by a wildcard, or whose lookup fails; a user with no email; an existing seat or paid order; a session of another kind or without ids. Wiring: the gate and the one-ticket rule precede the Stripe session; verify applies the rule before writing; the paid order and the seat errors are read; the free RSVP uses the shared rule and keeps its answers. Mutation check: unescaping the wildcard fails its test. Not run: against Stripe.

## Please check
- **A session created before this change** for a private stage by someone the stage never invited has no `entry_checked`: verify refuses to seat it (403, `paid: true`) and logs it. Such a payment needs a person (a refund or an invitation); I did not touch payment state.
- Because the seat is written only after the rule, a buyer of a stage whose invitation was revoked between checkout and verification is not seated: the same 403.

## Found, not changed
- **Where the money goes.** The ticket is charged on the platform account with no destination: the stage host is not paid by these functions (the same question as for milestones, invoices and payment links: who pays the creator and where is it recorded?).
- **Capacity is a plain read** at checkout, and `verify-stage-ticket` never rechecks it, so concurrent buyers can sell past `capacity` (as events could before #190). A paid buyer is seated regardless. An atomic reservation needs a function in the database (a migration).
- No refund path for a stage ticket exists in these functions (`curated_stage_order_status` has `refunded` but nothing writes it).

## Release and rollback
Paste `_shared/stageTicket.ts`, then `checkout-stage-ticket`, `verify-stage-ticket` and `rsvp-curated-stage`. No frontend change. Rollback: re-paste the previous functions; the helper can stay.
