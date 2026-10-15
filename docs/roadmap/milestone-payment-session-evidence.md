# create-milestone-payment: a funded milestone is not paid twice, and the project and title come from the row

Code only: no migration, no policy, no grant, no secret, no data change. The fee maths, the manager commission, the line items, the Checkout metadata, the manual capture for escrow and the idempotency key are untouched. Not deployed. This is the last of the milestone money functions named in `paid-state-writers-map.md` (#183, section 6) after `batch-milestone-payout` (#196); the single-milestone capture and the webhook were read for comparison only.

## What was reviewed and is fine
The charge amount is read from the milestone row, never from the request (`clientAmount` is logged and ignored); the caller must be the project's client or owner before any Stripe call; the fees are computed server-side from the **payer's** tier; the payer is recorded on the session and the PaymentIntent (`userId`), which `capture-milestone-payment` and, since #196, the batch use to bind the release; the idempotency key collapses an identical request for 24 hours.

## Findings (repository evidence; not reproduced against Stripe)
| # | Where | Evidence | Effect |
|---|---|---|---|
| M1 | `create-milestone-payment` | the only "already paid" guard was `milestone.status === 'paid'`. A milestone whose escrow is held (`escrow_status = 'authorized'`, status `review`) is not `paid` | a second Checkout session can be created for a funded milestone (the idempotency key only collapses an identical request within 24 hours, and changes with the fee total). The webhook skips an already-authorized or already-paid milestone, so a second payment is recorded by nobody: captured and unrecorded, or held and expiring |
| M2 | same | `projectId` and `title` were taken from the request body and written into the success/cancel URLs, the session and PaymentIntent metadata and the product name | metadata that disagrees with the milestone's real project; free text on the Checkout page |
| M3 | same | the row's `amount` was used unchecked (null, zero, negative, a fraction of a cent) | a malformed row builds a malformed charge; Stripe refuses most, not all, and the failure is a 500 |
| M4 | same | `Authorization!` crash; `req.headers.get("origin")` used raw (`null/desk/...` when absent) | a `TypeError` as the answer; an invalid redirect URL for API callers |

## What changed
- `_shared/milestonePayable.ts` (pure, no dependency): `checkMilestonePayable` (refuses a milestone that is `paid`, has `paid_at`, is `captured` (409), or is `authorized` in escrow (409); refuses an amount that is not a positive, finite sum of whole cents of at most 1,000,000 (422); returns the clean amount) and `checkoutTitle` (the row's title, else the client's, clipped to 120).
- `create-milestone-payment`: the milestone row now also reads `title`, `escrow_status`, `paid_at`; the check runs after the payer gate and before any Stripe call; the project id and title come from the row; a missing Authorization header answers cleanly; the redirect origin falls back to `https://www.thrivein.io` as the other ticket and payment functions do.
- A milestone whose escrow was **cancelled** (`status` back to `review`, `escrow_status = 'cancelled'`) can be funded again, as before.

## Tests
`src/lib/__tests__/milestonePayable.test.ts` (16). Denied first: paid by status, by `paid_at`, by `captured`; held escrow at any status; missing, zero, negative, non-finite, non-numeric and boolean amounts; fractions of a cent; above the ceiling; the paid check precedes the amount check. Wiring: the payer gate precedes the check, which precedes `customers.list` and the session creation; the project and title are read from the row; `projectId` is no longer destructured from the body; the metadata, manual capture, `kind: 'milestone'`, the idempotency key and the line item amount are unchanged. Not run: against Stripe or a project.

## Please check
- **This guard trusts the row.** It is only as strong as who may write `milestones.status`, `escrow_status` and `paid_at`. `20260824100000_milestones_privilege_hardening.sql` is headed "PREPARED, NOT APPLIED" and records a live test in which a direct client PATCH of `status = 'paid'` and `escrow_status = 'authorized'` returned 204; `20260910130000` and `20260913110000` follow it. I cannot see which of them production has. The read-only question for whoever has production access: which columns of `public.milestones` can `authenticated` UPDATE (`information_schema.column_privileges`, grantee `authenticated`, privilege `UPDATE`)? If `status`, `escrow_status` or `paid_at` appear, the guards on every payment function can be set by the party they are meant to constrain.
- A milestone that is paid or funded now answers 409 with the same wording the board already shows for "already paid"; a funded one says so.

## Found, not changed
- `projects.created_by` is accepted as a payer (and therefore as the party the PaymentIntent records). A freelancer who owns a project can fund its escrow with their own card; the recorded-payer rule then limits who can release it. Whether the owner and the client should both be payers is a product question.
- A second session for a milestone still `pending` (never paid) remains possible after the fee total changes (a tier change or a new manager referral); both sessions can be paid, and the webhook then skips the second. A session-level "one open session per milestone" rule needs the session id stored on the milestone (a column) or an expiry of the earlier session: a design for you.

## Release and rollback
Paste `_shared/milestonePayable.ts`, then `create-milestone-payment` (its other imports, `stripeEnv`, `platformFees` and `resolveMilestonePayee`, are unchanged). No frontend change. Rollback: re-paste the previous function; the helper can stay.
