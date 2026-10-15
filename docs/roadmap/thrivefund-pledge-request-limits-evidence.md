# thrivefund-create-pledge: a bounded, single, honest pledge request (option C)

Approved by the owner in chat on 2026-10-15 ("option B puis A et C ... je valide"). Code only: no migration, no policy, no secret, no data change, and the payment mechanics (manual capture, application fee, transfer destination, `authorized` row, Checkout session) are unchanged. Not deployed. This is the access-control half; the state half is option A (`proposal-thrivefund-pending-pledge-state.md`, needs a migration) and the finalizer half is option B (#184).

## Findings (repository evidence)
| # | Where | Evidence | Effect |
|---|---|---|---|
| C1 | `thrivefund-create-pledge` | `if (!amount || amount <= 0)`: any number above zero, no ceiling; a string passes | an unpaid pledge of any size is counted by the database totals before anyone pays |
| C2 | same | no check that the caller is not the campaign's `creator_id` | a creator can back their own campaign (with a second account or the same one) and move its totals |
| C3 | same | `isAnonymous` and `backerMessage` stored as sent: any type, any length | an object or megabytes of text written to the row |
| C4 | same | every call inserts a new `authorized` pledge, whatever the caller already has | one account can open any number of pledges per campaign; each counted before payment |

## What changed
- `_shared/pledgeRequest.ts` (pure): amount positive, finite, **at most 10,000** campaign-currency units and at most two decimals; the campaign's own creator refused with 403; `isAnonymous` true only for the literal true; the message a string with control characters removed, clipped to 500, or null.
- `thrivefund-create-pledge`:
  - the request is checked after the campaign is read and before anything is created;
  - **one live pledge per account and campaign**: the backer's earlier `authorized` pledges on the campaign are settled first. A completed Checkout session is a pledge already made (409); an open one is superseded (its session expired at Stripe, its row set `cancelled`, so the totals stop counting it); an expired one is cancelled. A session Stripe cannot be read for, or whose status is not understood, answers 503 and nothing is created;
  - the checked values are the ones stored and sent to Stripe.

## Tests
`src/lib/__tests__/pledgeRequest.test.ts` (16). Allowed: an ordinary pledge, a numeric string, two decimals, the ceiling itself, one cent. Denied: the creator (any amount), above the ceiling, zero, negative, NaN, infinities, non-numeric, empty, objects, booleans, three decimals, less than a cent, a lower ceiling; message types and clipping; `isAnonymous` literals; the live-pledge classification (complete, open, expired, missing, unknown). Wiring: checked before anything is created; checked values only; earlier pledges settled before the insert, failing closed; payment mechanics untouched. Not run: against Stripe or a real campaign.

## Please check (owner decisions I had to make)
- **The ceiling, 10,000 per single pledge**, is mine; one constant in `_shared/pledgeRequest.ts`. A backer wanting to give more must wait for a different policy.
- **Increasing a pledge is not supported**: an account holds one live pledge per campaign. To change the amount a backer starts again: the open session is superseded.
- The two-decimal rule rejects a request the old function would have rounded.

## Not addressed
- The confirmation email still says "pledge confirmed" at session creation; it belongs with option A (after authorisation).
- Two simultaneous requests from one account can both pass the live-pledge check (at most two pledges, and the finalizer verifies each at Stripe).
- The totals of an active campaign still count unpaid rows until A lands.

## Release and rollback
Paste `_shared/pledgeRequest.ts`, then `thrivefund-create-pledge`. Rollback: re-paste the previous function; the helper can stay. The frontend needs no change: refusals come back as `{ error }` with a status, as before.
