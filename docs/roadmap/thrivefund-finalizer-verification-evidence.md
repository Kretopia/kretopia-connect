# ThriveFund finalizer: the goal is decided from verified authorisations (option B)

Approved by the owner in chat on 2026-10-15 ("option B ... puis A et C ... je valide"): this is the approved slice for the finalizer part of `proposal-thrivefund-pledge-authorization-state.md` (#180). Option A (a pending state and a signed webhook) and option C (access-control hardening of `thrivefund-create-pledge`) are separate slices. Code only: no migration, no policy, no secret, no data change. Not deployed.

## Threat
Pledge rows are written as `authorized` when the Checkout session is created; the totals trigger counts them; the finalizer decided `goalMet` from `campaigns.total_raised` and then captured the genuine backers' cards. An account that never paid could push a campaign over its goal and make real backers be charged for a campaign that was not funded (and let the creator release tranches).

## What changed (`thrivefund-finalize-campaign` + `_shared/pledgeVerification.ts`)
1. **Pass 1, read-only at Stripe.** Every `authorized` pledge's payment intent is retrieved. It counts only if Stripe reports it `requires_capture`, for at least the pledged amount, in the campaign's currency, and its metadata names this pledge and this campaign. Pledges already `captured` or `released` count as settled (they were verified when captured).
2. **The goal is decided from that sum** in integer cents. A goal that is not a positive number is never met. A campaign already `funded` or `failed` keeps its outcome (a re-call is not a re-decision).
3. **Fail closed.** If any pledge cannot be checked (Stripe error), the function answers 503 and captures or cancels nothing; it is idempotent, run it again.
4. **Pass 2, act.** An unverified pledge is cancelled (its payment intent too, best effort, so it cannot be authorised after the deadline) and is **never captured**, whatever the total said. A verified pledge is captured (first tranche) if the goal is met, else its authorisation is released: exactly as before.
5. The result emails report the verified total and the verified backer count, not the stored ones.

Cancelling the phantom rows makes the totals trigger recompute `total_raised` and `backer_count` without them, so the displayed numbers are also corrected for the campaign at finalization.

## Cases
| Case | Before | Now |
|---|---|---|
| 3 real authorisations of $20, 60 phantom pledges of $1,000 each, goal $1,000 | goal "met" from the stored total: the 3 real cards captured | verified total $60: goal not met, the 3 authorisations released, phantoms cancelled |
| Real authorisations reach the goal, some phantoms too | all captured | real ones captured, phantoms cancelled |
| A pledge whose intent covers less than it says, or names another pledge or campaign | captured | cancelled |
| Stripe unreachable for one pledge | decided on the stored total | 503, nothing changed |
| Re-run after finalization | no-op | no-op (captured and released pledges count as settled; status kept) |

## Tests
`src/lib/__tests__/pledgeVerification.test.ts` (22): positive amount in cents; the phantom pledge; every non-capturable intent status; a short authorisation; another pledge or campaign; another currency; a bad pledge amount; exact-goal and one-cent-short; settled pledges keep a re-run's outcome; an invalid goal is never met; integer-cent sums; and the wiring (no `total_raised >= goal` left, verification before any capture or cancel, 503 before any capture, an unverified pledge cancelled before the goal is consulted, outcome of a finalised campaign kept, verified figures in the emails, the admin or cron guard and the deadline guard kept). Not run: against a real Stripe account or a real campaign.

## Not addressed (separate slices)
- **Option A**: a pending state counted by no total, moved to authorised by a signed webhook. Needs a new `capture_status` value: the column has a CHECK constraint (`authorized`, `captured`, `released`, `refunded`, `failed`, `cancelled`), so it needs a migration: a proposal, not code (see the PR that follows).
- **Option C**: amount ceiling, no creator pledge on their own campaign, one live pledge per backer: next PR.
- The displayed totals of an *active* campaign still include unpaid rows until A lands; only finalization corrects them.
- Pledges are verified one after another: a campaign with several hundred pledges makes several hundred Stripe reads in one invocation.

## Release and rollback
Paste `_shared/pledgeVerification.ts`, then `thrivefund-finalize-campaign`. Rollback: re-paste the previous function; the helper can stay. Do not let the finalizer run on any campaign between the old and the new copy.
