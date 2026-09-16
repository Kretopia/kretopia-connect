# Escrow Transfer Idempotency Report

**Status: `BLOCKED_TRANSFER_IDEMPOTENCY` → code now written this pass, `ESCROW_CODE_HARDENED_NOT_TESTED`. Zero real Stripe transfers were created while producing this report or the code it documents.**

Closes `ESCROW_IDEMPOTENCY_REPORT.md`'s highest-severity finding:
`capture-milestone-payment/index.ts` called `stripe.transfers.create()`
for manager commissions with no idempotency key and no persisted
record of which `(milestone, manager)` pairs had already been paid — a
retry, double-click, or concurrent duplicate request could move real
money a second time.

## The fix, in one paragraph

A new table, `milestone_commission_transfers`
([migration, prepared not applied](supabase/migrations/20260824120000_milestone_commission_transfer_idempotency.sql)),
whose `PRIMARY KEY` is `(milestone_id, manager_id)` — that composite
key *is* the deterministic operation key, not a separate random value.
[`capture-milestone-payment/index.ts`](supabase/functions/capture-milestone-payment/index.ts)
now `INSERT`s a `'reserved'` row there before ever calling Stripe,
passes the same deterministic string as Stripe's own
`idempotencyKey` option, and updates the row to `'completed'` (with
the real `stripe_transfer_id`) or `'failed'` (with the error, so a
future retry isn't permanently blocked) depending on the outcome. This
exact shape — dedicated ledger table, PK-as-operation-key,
reserve-before-call, resolve-after — mirrors the pattern already
sanctioned and applied in production for the same class of problem:
`thrivefund_milestone_releases`
(`20260818120000_thrivefund_milestone_release_idempotency.sql`), not a
new design invented for this task.

## Operation key composition

```
milestone_commission_transfer:{milestoneId}:{managerTableId}
```

Stable business identity only: the milestone being paid (which
implies the project, via `milestone.project_id`) and the manager
receiving the commission. No timestamp, no request ID, no random
component — a retry of the *same logical operation* always produces
the *same* key, which is the entire point (a random per-attempt key
would make Stripe's own idempotency cache useless, since every retry
would look like a brand-new request to Stripe).

## Walkthrough of the requested test scenarios (code trace, not a live run)

No real transfer was created for any of these — each is a trace of
what the code in `capture-milestone-payment/index.ts` (lines ~160–296)
actually does, verified by reading it, not by invoking it against
Stripe.

| # | Scenario | Code path taken |
|---|---|---|
| 1 | First transfer attempt | `INSERT` succeeds (no conflict) → `ledgerRow` = the new `'reserved'` row → falls through the `mismatched` / `completed` / `isFreshConcurrentReservation` checks (all false for a brand-new row) → calls Stripe with `idempotencyKey` → on success, `UPDATE ... SET status='completed', stripe_transfer_id=...` |
| 2 | Duplicate click (same request re-sent quickly) | Second `INSERT` hits the `(milestone_id, manager_id)` primary key conflict (`23505`) → looks up the existing row → if it's already `'completed'`, skips with a log line, no second Stripe call. If the first request hasn't resolved yet (`'reserved'`, <60s old, different `reserved_by`... though in practice this is almost always the *same* `user.id` retrying, so `isFreshConcurrentReservation` may read `false` for a same-user double-click — see the gap noted below), it proceeds toward the Stripe call, which is still safe because the *Stripe-side* idempotency key is identical, so Stripe itself dedupes it |
| 3 | Concurrent duplicate (two different invocations, genuinely racing) | Whichever `INSERT` loses the race gets the `23505` conflict, reads back the winner's row with `status='reserved'` and a very fresh `created_at` → if `reserved_by` differs from the current caller (e.g. two different processes triggered by two different authorized callers, or two independent retries), `isFreshConcurrentReservation` is `true` → skipped without calling Stripe |
| 4 | Timeout after Stripe request (unknown outcome) | The `stripe.transfers.create()` call throws (network timeout) → caught → row set to `status='failed'`, `last_error` recorded. Whether the transfer actually reached Stripe is genuinely unknown at this point — that's what the reconciliation query in the migration file is for |
| 5 | Retry after timeout | New invocation with the same `(milestoneId, managerTableId)` → `INSERT` conflicts → existing row has `status='failed'` → none of `mismatched`/`completed`/`isFreshConcurrentReservation` block it → retries the Stripe call with the **same** `idempotencyKey` → if the original attempt actually landed at Stripe, Stripe's own 24h idempotency cache returns the original transfer instead of creating a second one; if it never landed, a fresh transfer is created and recorded |
| 6 | Stripe failure (e.g. invalid destination account, not a timeout) | Same path as #4 — `status='failed'`, `last_error` set to Stripe's actual error message. Nothing distinguishes a "will never succeed" failure from a "transient" one in this implementation; both land in `'failed'` and both are retryable on a future invocation. This is a real, acknowledged limitation — see "What was not built" below |
| 7 | Duplicate webhook (`transfer.reversed` delivered twice) | Outer `stripe_webhook_events` event-ID dedup (pre-existing, unchanged) rejects the second delivery before the handler body runs at all — never reaches the `transfer.reversed` branch a second time |
| 8 | Already-completed transfer (any retry after `status='completed'`) | `ledgerRow.status === 'completed'` check fires first (before the concurrent-reservation check) → logged as "already completed, skipping" → Stripe is never called |
| 9 | Mismatched amount (same milestone/manager, different commission figure) | `mismatched` check compares `Number(ledgerRow.commission_amount) !== managerCommission` → `true` → logged as an error with both the expected and actual values → Stripe is never called. This can only actually occur if `metadata.managerCommission` on the PaymentIntent itself were tampered with or computed inconsistently between two captures of the same milestone, which the milestone's `status='paid'` idempotency check elsewhere should already prevent — this is defense in depth, not the primary guard |
| 10 | Mismatched destination (same milestone/manager, different Stripe account) | Same `mismatched` check, `ledgerRow.destination_account !== managerStripeAccountId` branch → same outcome, refused |
| 11 | Unauthorized caller | Not reachable at all — `assertCanReleaseMilestone` (in `_shared/escrowAuth.ts`) runs before any of this code, at the top of `capture-milestone-payment`'s handler, and throws `EscrowAuthError` (HTTP 403) before the function ever gets near the commission-transfer block. This scenario is already covered by the pre-existing authorization gate, confirmed live in `ESCROW_RLS_NEGATIVE_TEST_REPORT.md` tests 1–2, not by anything added in this pass |

## What was NOT built (acknowledged gaps)

- **No automatic retry / cron reconciliation.** A `'reserved'` row that
  never resolves (crash between `INSERT` and the Stripe call) sits
  that way until a human runs the reconciliation query in the
  migration file and decides what to do. Nothing in this codebase
  currently re-invokes `capture-milestone-payment` automatically, so
  building an automatic sweep was judged out of scope — flagged, not
  built.
- **No distinction between retryable and terminal Stripe errors.** A
  permanently-invalid destination account and a transient network
  blip both land in `status='failed'` and both are equally retryable
  by a future invocation. A more complete implementation would inspect
  the Stripe error type (`StripeInvalidRequestError` vs
  `StripeConnectionError`, etc.) and only permit retry for the latter.
  Not built this pass — the ledger's `last_error` column preserves
  enough information for a human reconciling manually to tell the
  difference themselves.
- **Same-user rapid double-click may not always be caught by
  `isFreshConcurrentReservation`** (it checks `reserved_by !== user.id`,
  so a genuine same-user double-submit within 60s could pass that
  specific check and proceed toward the Stripe call). This is
  intentional, not an oversight: the actual duplicate-prevention
  backstop for that exact case is Stripe's own idempotency cache via
  the shared `idempotencyKey`, not this application-level check —
  the application-level check exists to avoid an unnecessary Stripe
  round-trip for the *cross-process* concurrent case, not to be the
  sole guarantee against duplication.

## What would move this to `ESCROW_SANDBOX_VERIFIED`

1. Apply `20260824120000_milestone_commission_transfer_idempotency.sql`
   (same manual-approval process as
   [ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md](ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md) —
   this migration is equally unapplied and equally requires the same
   preflight/postflight discipline before being run).
2. Real Stripe test-mode credentials
   (`BLOCKED_STRIPE_TEST_CONFIGURATION`, unchanged).
3. A test manager with a real (test-mode) Stripe Connect account, and a
   test milestone with a manager commission attached — then actually
   run scenarios 1–3 above against Stripe test mode and inspect the
   Stripe Dashboard's idempotency-key-scoped request log to confirm
   only one real transfer object was created per scenario, not just
   that the local ledger table looks correct.
