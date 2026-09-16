# Escrow State Machine

Derived from reading the actual code (`ESCROW_FLOW_AUDIT.md`), not from
the idealized state list this task specified. Where the code implements
fewer or different states than requested, that gap is stated explicitly
rather than papered over — the whole point of this document is to
record what actually happens, not what a well-designed system would do.

## Two separate fields, not one state machine

`public.milestones` tracks payment/escrow across **two columns**, not
one unified state:

- `status text` — `pending | in_progress | submitted/review | approved/completed | paid` (general milestone workflow, per `20250930134421_...sql` and later widening)
- `escrow_status text` — `none | authorized | captured | cancelled` (per the `CHECK` constraint on the column, first seen in `20251001071212_...sql:4`)

They move partially independently. The table below documents each real
transition found in code, its actual (not idealized) state values, and
whether the requested finer-grained states (`requires_capture`,
`funded`, `release_pending`, etc.) exist in this implementation at all.

## Real transitions, as implemented

| # | Transition | Trigger | Allowed actor | Prior state required | Server validation | Stripe condition | DB update | Webhook event | Notification | Audit | Idempotency key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | (none) → Checkout session created | Payer clicks "Pay" | Project client/owner only | `milestone.status <> 'paid'` | `create-milestone-payment`: payer-authorization check (`:97-109`), already-paid check (`:114-120`) | n/a (pre-Stripe) | None yet — no DB row changes here | n/a | n/a | `logStep` console logging only | **None** — no Stripe idempotency key on `checkout.sessions.create`, no reservation row |
| 2 | Checkout session created → PaymentIntent `requires_capture` | Payer completes Stripe-hosted Checkout with a real/test card | Stripe itself, off-platform | n/a | n/a — happens entirely inside Stripe | `capture_method: 'manual'` set at creation (`:266`) | **None** — confirmed no code path writes here (`ESCROW_FLOW_AUDIT.md` headline finding) | **None fires for escrow** (`stripe-marketplace-webhook` explicitly excludes `useEscrow==='true'`) | None | None | n/a |
| 3 | `requires_capture` → `captured` | Owner clicks "Release payment" | Whoever the PaymentIntent metadata records as payer, or (fallback) the project's client/owner (`escrowAuth.assertCanReleaseMilestone`) | Implicitly `escrow_status==='authorized'` per the UI's own gate — **which per transition 2 is never actually true**, so in practice this button may never render | `capture-milestone-payment`: `loadMilestoneForIntent` (milestone ↔ PaymentIntent match) + `assertCanReleaseMilestone` (`:60-68`) | `stripe.paymentIntents.capture()` must not throw | `status:'paid', escrow_status:'captured', paid_at, paid_to` (`:104-113`) — written by the edge function synchronously after the Stripe call succeeds, **not** webhook-confirmed | None consumed (would be redundant even if it fired) | 2 rows inserted directly (`:294-317`) — creator + payer, both in-app only, no email | None beyond `logStep` console output | **None** — no idempotency key on `paymentIntents.capture()`; a duplicate capture call would fail at Stripe (can't capture twice) rather than being a designed no-op |
| 4 | `requires_capture` → `cancelled` | Owner clicks "Cancel escrow" | Same authorization as #3 | Same caveat as #3 | Same as #3 | `stripe.paymentIntents.cancel()` must not throw | `status:'review', escrow_status:'cancelled', paid_at:null, paid_to:null` (`:104-113`) — note `status` becomes `'review'`, not a distinct "canceled" value; overloads the same field the ordinary workflow uses for "ready for review" | None | 1 row inserted (`:320-332`) — creator only, "escrow refunded" (mislabeled — see `ESCROW_FLOW_AUDIT.md` finding 3; nothing was refunded, an authorization was released) | None | None |
| 5 | `captured` → (manager commission transferred) | Automatic, inline with transition 3, only if a manager referral exists | System (server-side, no separate user action) | `hasManager && managerCommission > 0` | None beyond what already passed for #3 | `stripe.transfers.create()` must not throw | `referral_commissions` insert (`status:'paid'` or `'earned'` depending on transfer outcome) | None | None for this specifically | `logStep` only | **None** — no idempotency key on `transfers.create()` |
| 6 | Any → batch payout eligibility | — | — | `escrow_status==='authorized' && payment_intent_id && status==='review'` (`batch-milestone-payout/index.ts:79`) | Not audited this pass — out of scope, flagged for awareness: this condition **also depends on the never-set `'authorized'` value**, so this batch path likely can't select escrow milestones either | — | — | — | — | — | — |

## Requested states vs. what actually exists

| Requested state | Exists in this implementation? |
|---|---|
| `draft` | No explicit value found — `pending` appears to be the default/initial `status` |
| `payment_pending` | No — nothing between "not paid" and Stripe-side `requires_capture` is ever recorded |
| `requires_payment_method` / `requires_action` | Not tracked in Kretopia's DB at all — these are Stripe-side PaymentIntent statuses during the hosted Checkout flow; the app never queries or stores them |
| `requires_capture` | **Real Stripe state, never mirrored into Kretopia's DB** — this is the core gap |
| `authorized` | Exists as a valid `CHECK` value on `escrow_status`, **never written by any code path** |
| `processing` | Not tracked |
| `funded` | Not a distinct value — closest is the same never-reached `authorized` |
| `capture_requested` | Not tracked as a distinct pre-capture state — the capture call is synchronous, so there's no observable "requested but not yet resolved" window in the DB (there is one at Stripe, briefly, during the API round-trip) |
| `captured` | Real, implemented (`escrow_status='captured'`) |
| `completed` | `status` has a `completed` value used for the general workflow (work marked done), **conflated with, not identical to, payment completion** — a milestone's work can be `completed` independent of whether it's been paid at all |
| `canceled` | Implemented, but stored as `status='review'` + `escrow_status='cancelled'` — not a single clean "canceled" value |
| `refunded` | **Not implemented anywhere in this codebase** — no `stripe.refunds.create()` call exists for any payment type |
| `failed` | Not tracked — a failed/declined payment simply never reaches transition 2; nothing records that an attempt was made and failed |
| `disputed` | Not tracked — no `charge.dispute.*` webhook handling found anywhere |
| `expired` | Not tracked — Stripe auto-expires an uncaptured manual-capture PaymentIntent after its own window; nothing in Kretopia listens for or reflects this |
| `release_pending` | Not applicable — capture is synchronous, not a two-phase request/approve |
| `released` | Conflated with `captured` — same transition, no distinct "released to creator" vs "captured by platform" states |
| `payout_blocked` | Exists as a real concept for Stripe Connect payouts generally (`creator_wallets.payouts_enabled`, extensively covered elsewhere this session), not specific to escrow milestones |

## What this means for testing

Given transition 2 (the actual funding event) never touches the
database, **any test of "does the milestone show authorized/held after
payment" will fail by design, not by bug-in-the-test** — there is
nothing to observe. A test plan that expects to see `escrow_status`
become `'authorized'` after a successful test-mode Checkout completion
would need either (a) the missing webhook handling to be built first, or
(b) a manual, out-of-band way to trigger the equivalent of transition 3
(e.g., calling `capture-milestone-payment` directly with the real
`payment_intent_id`, bypassing the UI's own gate, which itself only
appears when `escrow_status==='authorized'` — a real chicken-and-egg
problem for anyone trying to manually test this via the UI as it exists
today).

## Idempotency summary (detail in `ESCROW_IDEMPOTENCY_REPORT.md`)

No transition in this flow uses a Stripe idempotency key. Transition 1
(session creation) and transition 3 (capture) are the two most exposed
to a double-click/retry — both call a Stripe API mutating method with no
idempotency key and no reservation-row pattern, unlike the
already-proven pattern this same codebase uses elsewhere
(`thrivefund_milestone_releases`).
