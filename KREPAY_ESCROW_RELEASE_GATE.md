# KrePay Escrow Release Gate

**Final status: `ESCROW_CODE_HARDENED_NOT_TESTED`**

This is the consolidated gate for escrow specifically, sibling to
`KREPAY_RELEASE_GATE.md` (the general KrePay gate) and
`SECURITY_RELEASE_GATE.md` (wallet/profile privilege gate). It does not
supersede either — all three must independently clear before escrow
could be considered release-ready.

## What changed in this pass

The prior version of this gate (status `BLOCKED_STRIPE_TEST_CONFIGURATION`)
listed three independent blockers. This pass closed two of them **at
the code level only** — nothing here has been deployed, applied to the
live database, or tested against a real Stripe event:

| Blocker | Before this pass | After this pass |
|---|---|---|
| Milestones privilege gap (live client-writable `status`/`escrow_status`) | Migration prepared, not applied | **Unchanged** — still prepared, not applied. Runbook for applying it now exists: [ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md](ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md) |
| Escrow webhook handling | Absent entirely | **Written this pass** — [ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md](ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md). Code-complete, zero live tests |
| Manager-commission transfer idempotency | Absent entirely | **Written this pass** — [ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md](ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md). Code-complete, requires its own new migration (also prepared, not applied), zero live tests, zero real transfers created |
| Stripe test-mode configuration | Absent | **Unchanged** — still absent. This is infrastructure/credentials, not something code changes can close |

## Section-by-section status

| Report | Status |
|---|---|
| `ESCROW_FLOW_AUDIT.md` | Done (audit) |
| `ESCROW_STATE_MACHINE.md` | Done (audit) |
| `ESCROW_RLS_NEGATIVE_TEST_REPORT.md` | Done, executed live (8 real HTTP tests) |
| `ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md` | Done (runbook) — `BLOCKED_MIGRATION_NOT_APPLIED` |
| `ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md` | Done (code written) — untested |
| `ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md` | Done (code written) — untested, zero real transfers |
| `ESCROW_SANDBOX_TEST_REPORT.md` | Done — `BLOCKED_STRIPE_TEST_CONFIGURATION`, 0 of ~40 Stripe-dependent scenarios executed |
| `ESCROW_WEBHOOK_VERIFICATION_REPORT.md` | Done, updated this pass — documents old gap + what closed it, still zero live webhook verification |

## Why this is `ESCROW_CODE_HARDENED_NOT_TESTED`, not further along

Three things would each independently block `ESCROW_SANDBOX_VERIFIED`,
let alone anything beyond it:

1. **Neither new migration is applied.** [`20260824100000_milestones_privilege_hardening.sql`](supabase/migrations/20260824100000_milestones_privilege_hardening.sql)
   (privilege gap) and [`20260824120000_milestone_commission_transfer_idempotency.sql`](supabase/migrations/20260824120000_milestone_commission_transfer_idempotency.sql)
   (commission ledger) are both prepared, both verified clean against
   the project's regression gate, and both require the exact manual
   Lovable Cloud SQL Editor process this session has used for every
   prior migration — not something Claude applies itself. Until the
   second one is applied, the transfer-idempotency code fails closed
   (skips the transfer entirely, logs a warning) rather than running
   without its guard — a deliberate, safe default, but it means the
   idempotency code cannot even be exercised yet.
2. **No Stripe test-mode configuration exists.** Confirmed
   independently three times now across this engagement (the parallel
   session's `KREPAY_STRIPE_SANDBOX_REPORT.md`, this session's earlier
   `ESCROW_SANDBOX_TEST_REPORT.md`, and unchanged by anything in this
   pass). No `STRIPE_SECRET_KEY_TEST`, no webhook signing secrets, no
   registered endpoints. Every one of the 50 originally-requested
   sandbox scenarios remains unexecuted.
3. **New code has never run.** The escrow webhook branches and the
   transfer-idempotency reservation logic exist in the repo, pass
   typecheck/test/build, and were traced line-by-line against every
   requested test scenario in their respective reports — but neither
   has processed a single real event or made a single real (test-mode
   or live) Stripe API call. Code review is not the same evidence class
   as live verification, and this gate does not conflate the two.

## What would move this gate forward, in order

1. User applies both prepared migrations via Lovable Cloud, following
   [ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md](ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md)'s
   preflight → apply → postflight → negative-test sequence for the
   privilege migration, and equivalent care for the commission-ledger
   migration (inspect, apply, confirm the table + RLS policy exist,
   confirm `authenticated` cannot write to it directly).
2. Obtain real Stripe test-mode credentials and register test webhook
   endpoints subscribed to the event set listed in
   `ESCROW_SANDBOX_TEST_REPORT.md`'s updated unblock list.
3. Run the full sandbox matrix (`ESCROW_SANDBOX_TEST_REPORT.md`
   sections A–F), using a referral-free test milestone for the base
   capture scenarios and a separate referral-attached test milestone
   specifically for the commission-transfer scenarios in
   `ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md` (duplicate click, concurrent
   duplicate, retry-after-timeout, etc.) — verifying, for each, that
   the Stripe object, the webhook delivery, the database row, the UI,
   the audit trail, the idempotency ledger, and the authorization check
   all agree, per this task's own release criterion.
4. Only after all of the above genuinely pass: re-evaluate this gate.
   `ESCROW_SANDBOX_VERIFIED` requires the complete matrix passing, not
   a representative subset. `ESCROW_READY_FOR_MANUAL_LIVE_APPROVAL` and
   `ESCROW_LIVE_VERIFIED` are both further still, and the latter
   requires explicit user approval plus a controlled live transaction —
   neither is remotely in scope for this pass or any pass without that
   explicit approval.

## Explicit non-claims

This gate does not claim escrow is close to ready for real money. It
does not claim the newly-written webhook or idempotency code is
bug-free — only that it was traced against every scenario the task
requested and reasoned through explicitly, with acknowledged gaps
documented rather than hidden (see each report's own "what was not
built" sections). No live payment, test or real, was created,
authorized, captured, refunded, or transferred in the course of this
pass. No SQL was applied to any database. No Edge Function was
deployed.
