# Escrow Sandbox Test Report

**Status: `BLOCKED_STRIPE_TEST_CONFIGURATION`** (unchanged by this
pass's code hardening — see the updated §"What would unblock this"
below for what has and hasn't changed)

Per Section 0's own stop condition: *"If Stripe mode cannot be verified:
stop immediately; return `BLOCKED_STRIPE_TEST_CONFIGURATION`."* Already
known, not re-discovered this pass — confirmed moments before this task
by the parallel Lovable session's own `KREPAY_STRIPE_SANDBOX_REPORT.md`:
no `STRIPE_SECRET_KEY_TEST`, no `STRIPE_MODE`, none of the three webhook
signing secrets exist, and live-mode was independently confirmed
empirically (`GET /v1/products` → `livemode: true`). Nothing in this
session's escrow investigation changes that.

**Zero PaymentIntents, Checkout Sessions, or any other Stripe object
were created for this task.** Every test matrix scenario below (A
through F in the original request) that requires an actual Stripe API
call is blocked for that reason, not attempted, not simulated.

## What was done instead

- Full static trace: `ESCROW_FLOW_AUDIT.md`
- State machine derived from code: `ESCROW_STATE_MACHINE.md`
- Real client-path authorization tests (no Stripe calls involved,
  since every test's Edge Function call fails at the milestone-lookup
  step before ever reaching Stripe): `ESCROW_RLS_NEGATIVE_TEST_REPORT.md`
- A real, previously-unknown privilege gap found and a fix prepared
  (not applied): `20260824100000_milestones_privilege_hardening.sql`

## Test matrix status (from the original request)

| Section | Scenarios | Status |
|---|---|---|
| A. Creation and authorization (1-8) | 8 | Partial — authorization (5,6,7) and duplicate-request (8) behavior reviewed in code (`ESCROW_FLOW_AUDIT.md`, no idempotency key found); amount/currency/metadata derivation (2,3,4) confirmed correct in code; none run against a real Stripe object |
| B. Successful authorization (9-12) | 4 | **BLOCKED** — requires a real test-mode Checkout completion |
| C. Capture (13-21) | 9 | **BLOCKED** — requires a real `requires_capture` PaymentIntent; authorization check (14) is code-reviewed + partially client-path tested (unauthorized/nonexistent-target rejection confirmed, real cross-user rejection not tested — no second identity available) |
| D. Cancellation/release (22-27) | 6 | **BLOCKED** — same reason as C |
| E. Failure paths (28-40) | 13 | **BLOCKED**, except: invalid webhook signature (31) and duplicate webhook (32) are covered structurally by the same offline signature tests already in `src/lib/__tests__/stripeWebhookSignature.test.ts` — those tests don't exercise escrow-specific logic (no escrow event is ever emitted, per `ESCROW_FLOW_AUDIT.md`'s headline finding) but do confirm the generic signature/dedup machinery any future escrow webhook handler would inherit |
| F. Security paths (41-50) | 10 | **Partially executable, partially executed** — see `ESCROW_RLS_NEGATIVE_TEST_REPORT.md`. Items 41-43 (client tries to mark funded/captured/change amount) map to the direct-table-write tests (found genuinely open, now with a prepared fix). Items 46-47 (unauthorized capture/release) map to tests 1-2 there (confirmed rejected). Items 48-49 (anonymous/unrelated-user mutation) map to tests 1,4 (confirmed rejected, with a secondary error-handling bug noted). Item 50 (webhook replay) not testable without a real event to replay. |

## Why no attempt was made to "simulate" a result

Fabricating a plausible-looking pass/fail table for the blocked
scenarios would be indistinguishable from a real test result to anyone
reading this report later, and would be exactly the kind of unverified
claim this task's own rules exist to prevent. Every blocked row above
stays blocked, explicitly, rather than filled in with an assumed
outcome — including the reasonable-sounding assumption that "the code
looks right so it would probably pass."

## What would unblock this

1. A real `STRIPE_SECRET_KEY_TEST`.
2. `STRIPE_MODE=test` (or equivalent) wired so `resolveStripeSecretKey()`
   — the parallel session's mode-switching helper — actually resolves
   to it.
3. Three test-mode webhook endpoints registered with their own signing
   secrets, subscribed to at minimum: `checkout.session.completed`,
   `payment_intent.canceled`, `payment_intent.payment_failed`,
   `charge.refunded`, `charge.dispute.created`, `transfer.reversed`
   (the exact set the handler now branches on — see
   `ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md`).
4. ~~The missing webhook handling for `useEscrow==='true'` events~~ —
   **done this pass**. `stripe-marketplace-webhook/index.ts` now has an
   escrow-authorization branch plus cancellation/refund/dispute/transfer-
   reversal handling. Still untested against a real event — see
   `ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md` for exactly what exists and
   what's still a known gap (refunds/disputes are logged, not
   auto-reconciled into a DB state, since the CHECK constraint has no
   value for either).
5. ~~Manager-commission transfer idempotency~~ — **done this pass**, code
   only. `capture-milestone-payment/index.ts` now reserves a
   deterministic-key ledger row before calling Stripe. Requires
   [`20260824120000_milestone_commission_transfer_idempotency.sql`](supabase/migrations/20260824120000_milestone_commission_transfer_idempotency.sql)
   to be applied first (prepared, not applied — same manual-approval
   process as the privilege migration) — until then, the code fails
   closed (skips the transfer with a warning) rather than proceeding
   without the guard. See `ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md`.
6. [`20260824100000_milestones_privilege_hardening.sql`](supabase/migrations/20260824100000_milestones_privilege_hardening.sql)
   applied and re-verified live (`BLOCKED_MIGRATION_NOT_APPLIED` — see
   [ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md](ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md)
   for the exact steps).
7. A **test milestone with no manager referral attached** — required to
   safely test the capture path at all when the commission-transfer
   ledger migration (#5) is *not yet* applied, since the code fails
   closed and simply skips the transfer in that case; and even once #5
   is applied, a referral-free milestone remains the simplest way to
   test capture (section C of the matrix) in isolation from the
   commission-transfer scenarios (which should be tested separately,
   deliberately, with a referral attached — see
   `ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md` scenario list).

Items 1–3 remain fully blocked (infrastructure/credentials, not code).
Items 4–5 are now code-complete but zero-percent live-tested. Item 6
is prepared but not applied. None of this changes the report's overall
status: the matrix in this document has still executed exactly zero
scenarios against a real Stripe object.
