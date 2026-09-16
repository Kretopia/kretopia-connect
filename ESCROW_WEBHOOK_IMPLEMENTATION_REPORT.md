# Escrow Webhook Implementation Report

**Status: `BLOCKED_ESCROW_WEBHOOK_MISSING` → code now written this pass, but `ESCROW_CODE_HARDENED_NOT_TESTED` — nothing below has been exercised against a real Stripe event.**

This documents the code added to
[`supabase/functions/stripe-marketplace-webhook/index.ts`](supabase/functions/stripe-marketplace-webhook/index.ts)
to close the gap `ESCROW_FLOW_AUDIT.md` and `ESCROW_WEBHOOK_VERIFICATION_REPORT.md`
found: no code path ever observed an escrow Checkout Session completing,
so `escrow_status` never left `'none'`. **Not deployed. Not tested
against a real Stripe event of any kind, test-mode or live.** The
function has been edited in the repo and passes the project's
regression gate (typecheck / 83-test suite / build), which proves it
compiles and doesn't break anything else — nothing more.

## What already existed and was reused, not rebuilt

- Signature verification (`stripe.webhooks.constructEventAsync` +
  `assertEventMatchesMode`) — unchanged, already correct.
- Event-ID deduplication via the `stripe_webhook_events` insert with a
  `23505`-conflict check — unchanged, already correct, and this is what
  every new branch below relies on for its outer redelivery guard.
- The `supabaseAdmin` service-role client, already instantiated once
  per invocation — reused, not duplicated.

## What was added

### 1. Escrow authorization (`checkout.session.completed`, `useEscrow === 'true'`)

New branch, inserted where a stale comment previously claimed escrow
was "confirmed separately at capture time" (true for capture, false
for authorization — nothing observed authorization at all). This
branch:

1. Loads the milestone; if `escrow_status !== 'none'`, skips
   (idempotent — already authorized, captured, or cancelled by a
   previous delivery or a race).
2. **Re-retrieves the PaymentIntent from Stripe directly** and checks
   `status === 'requires_capture'` before writing anything — the
   webhook payload's `session.payment_status` is not trusted alone for
   the state transition, matching the verification style
   `capture-milestone-payment` already uses.
3. Writes `escrow_status = 'authorized'` with a `WHERE escrow_status =
   'none'` compare-and-swap guard as a second, DB-level idempotency
   barrier against two concurrent deliveries of the same event.
4. Sends one notification to the creator and one to the payer, only on
   the delivery that actually won the compare-and-swap.

This is the only place in the codebase that writes
`escrow_status = 'authorized'`, and it now exists.

### 2. `payment_intent.canceled`

Stripe auto-cancels an uncaptured manual-capture PaymentIntent after 7
days; it can also be cancelled directly via the API or Dashboard.
Neither path goes through `capture-milestone-payment`'s own `cancel`
action, so before this change, an expired hold would leave the
milestone reading `escrow_status = 'authorized'` forever — a real,
previously undetected state-desync risk. New handling: `UPDATE ...
WHERE escrow_status = 'authorized'` (only ever transitions out of
`authorized`, never overwrites `captured` or an already-`cancelled`
row), then a notification if a row actually matched.

### 3. `payment_intent.payment_failed`

Deliberately a **no-op for DB state**, logged only. For the escrow
path this event can only occur before `checkout.session.completed`
ever fires (a failed charge attempt during the Checkout Session), so
`escrow_status` is still `'none'` by construction — there's nothing to
roll back. Explained in-line in the code so a future reader doesn't
assume this is an oversight.

### 4. `charge.refunded` and `charge.dispute.created`

**Known gap, not fixed — logged and flagged for manual review only.**
The `escrow_status` CHECK constraint
(`20251001071212_...sql`: `'none' | 'authorized' | 'captured' |
'cancelled'`) has no value for "refunded" or "disputed." Two options
existed: silently reuse `'cancelled'` (misleading — that value means
"never captured" everywhere else in the codebase and in
`ESCROW_STATE_MACHINE.md`'s documented model), or extend the
constraint with a migration. Extending the constraint was judged out
of scope for this pass — it's a schema change beyond the four named
blockers, not something to do speculatively inside a webhook-handler
task. Both events are logged (the raw event is already persisted via
the existing `stripe_webhook_events` insert) and trigger a high-priority
"needs review" notification to the milestone creator. **A real refund
or dispute today still requires a human to manually reconcile the
milestone row** — this pass makes that need visible instead of silent,
it does not close it.

### 5. `transfer.reversed`

Reconciliation hook for the manager-commission transfer ledger added in
Part 3 (`milestone_commission_transfers`, see
[ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md](ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md)).
Marks the matching ledger row `status = 'reversed'` by `stripe_transfer_id`.
Wrapped in its own try/catch because, as of this pass, that ledger
table is itself a prepared-not-applied migration — if this event
somehow arrives before that migration is applied, this must degrade to
a logged warning, not crash the whole webhook handler and take down
every other event type's processing with it.

## Events considered and deliberately NOT wired up

| Event | Reasoning |
|---|---|
| `payment_intent.created` | Fires at Checkout Session creation, before any customer action. Carries no new information not already known synchronously by `create-milestone-payment` at the moment it makes the call. |
| `payment_intent.processing` | Transient state for delayed payment methods (e.g. ACH). No UI in this codebase currently distinguishes "processing" from "not yet paid" — wiring a handler for a state nothing reads would be dead code. Flagged as a real gap if delayed payment methods are ever enabled for escrow. |
| `payment_intent.succeeded` | For a Checkout-based flow, Stripe's own guidance is to treat `checkout.session.completed` as the authoritative "session is done" signal rather than duplicating logic across both events — this codebase's existing non-escrow milestone branch already follows that convention, and the new escrow branch matches it for consistency. Wiring both would mean deduplicating two independent event streams against the same DB row, doubling the race-condition surface for no behavioral gain. |
| `payment_intent.amount_capturable_updated` | The precise Stripe-recommended trigger for "a manual-capture PaymentIntent is now authorized." Considered as the authorization trigger instead of `checkout.session.completed`. Not used, to avoid two independent event types both racing to write `escrow_status = 'authorized'` for the same milestone (more idempotency surface, not less, for a Checkout-based integration where `checkout.session.completed` already carries the same guarantee once the PaymentIntent is re-verified server-side, which this implementation does). |
| `payout.paid` / `payout.failed` | These describe Stripe moving money from a *platform's* Stripe balance to its *own* bank account — unrelated to any per-milestone or per-creator state this codebase tracks. Confirmed by grep: nothing in `src/` or `supabase/functions/` reads a `payout_id` anywhere in the milestones/escrow path. |

## What this does NOT prove

No event listed above has been sent to this handler, in test mode or
otherwise — no webhook endpoint exists to receive one
(`BLOCKED_STRIPE_TEST_CONFIGURATION`, unchanged from
`ESCROW_SANDBOX_TEST_REPORT.md`). This report documents what the code
now does if reached; `ESCROW_SANDBOX_TEST_REPORT.md` remains the
authority on what has actually been verified live, which is still
nothing for any of this. Do not read "implemented" as "verified."

## Newly discovered, out-of-scope bug (not fixed this pass)

While tracing the cancel path for context: `capture-milestone-payment/index.ts`'s
`action === 'cancel'` branch sets `newStatus = 'review'`
(`supabase/functions/capture-milestone-payment/index.ts:85`), but
`'review'` is not a valid value in the `milestones.status` CHECK
constraint (`requested|pending|in_progress|submitted|approved|paid`
only — `20260506234034_...sql`). Calling "cancel" on an escrow payment
today would very likely fail the subsequent `UPDATE` with a Postgres
CHECK-constraint violation, independent of anything in this pass. This
is not one of the four named blockers for this task and was not fixed,
per the instruction to stay scoped to those four. Flagged here so it
isn't lost.
