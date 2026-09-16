# Escrow Webhook Verification Report

**Status update (this pass): the gap described below has been closed
in code — see [ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md](ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md)
for exactly what was added. Nothing in this report has been
superseded by a live verification, only by new code. Overall status:
`ESCROW_CODE_HARDENED_NOT_TESTED`. No live webhook event has been
sent, received, or verified for escrow at any point in this
engagement — that specific status (`BLOCKED_STRIPE_TEST_CONFIGURATION`)
is unchanged and is tracked in [ESCROW_SANDBOX_TEST_REPORT.md](ESCROW_SANDBOX_TEST_REPORT.md).**

The section below is preserved as originally written (the audit that
motivated the fix) — it describes the state of the code *before* this
pass. It is being kept, not deleted, because it's the record of why the
fix in `ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md` exists.

## Headline finding (from `ESCROW_FLOW_AUDIT.md`) — historical, now fixed in code

`supabase/functions/stripe-marketplace-webhook/index.ts` — the only
webhook handler that touches `milestones`/Stripe Checkout Sessions —
used to explicitly exclude escrow sessions. Around line 175, the handler
branched on the Checkout Session's metadata:

```ts
if (session.metadata?.useEscrow !== 'true') {
  // ...existing non-escrow milestone-paid handling...
}
```

There was no corresponding branch for `useEscrow === 'true'`. A real
escrow Checkout Session completing, in test mode or live, would have
been received, evaluated against that condition, and silently dropped —
no error, no log entry distinguishing it, no DB write. **This pass adds
that branch** (full detail in `ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md`
§1) — the code described in this paragraph no longer matches what's in
the file. It is quoted here only to preserve the record of what was
found and why the fix was necessary.

## What DOES exist and would function if reached

- `src/lib/__tests__/stripeWebhookSignature.test.ts` — offline unit
  tests for the shared signature-verification helper used by every
  Stripe webhook function in this repo, escrow-relevant or not. These
  pass (part of the 83/83 suite) and confirm the generic
  signature-check/replay-rejection machinery works. They say nothing
  about escrow-specific payload handling, because none exists to test.
- `supabase/functions/_shared/stripeEnv.ts`'s `assertEventMatchesMode()`
  — added by the parallel session, would reject a live-mode event
  received while running in test mode (or vice versa) for any function
  that calls it, before that function's business logic runs at all.
  Relevant precondition for future escrow webhook work, not itself
  escrow logic.

## What existed at the start of this pass vs. what exists now

| | Before this pass | After this pass |
|---|---|---|
| `checkout.session.completed` + `useEscrow === 'true'` | Absent | **Added** — see `ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md` §1 |
| `payment_intent.canceled` | Absent | **Added** — §2 |
| `payment_intent.payment_failed` | Absent | **Added** (logged, deliberately no DB write — reasoning in §3) |
| `charge.refunded` | Absent | **Added** (logged + manual-review notification, no DB state transition — the `escrow_status` CHECK constraint has no value for it; see §4) |
| `charge.dispute.created` | Absent | **Added** (same as refunded — §4) |
| `transfer.reversed` | Absent | **Added**, reconciliation hook for the new commission-transfer ledger — §5 |
| `payment_intent.amount_capturable_updated` | Absent | **Deliberately not added** — `checkout.session.completed` is used as the authorization trigger instead, with a live PaymentIntent re-verification; adding both would double the idempotency surface for no gain. Full reasoning in `ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md`'s "Events considered and deliberately NOT wired up" table |
| Test-mode webhook endpoint registered with Stripe | Absent | **Still absent** — this is infrastructure/configuration, not code, and remains blocked (see below) |

## Why this can't be verified live right now

Verifying a webhook means: send a real event (or a `stripe trigger`
test-mode event through the CLI to a forwarded endpoint), observe the
handler receive it, confirm the resulting DB state. Every one of those
steps requires the test-mode Stripe configuration this task's Section 0
already found missing (`BLOCKED_STRIPE_TEST_CONFIGURATION`, consistent
across `KREPAY_STRIPE_SANDBOX_REPORT.md`, `ESCROW_SANDBOX_TEST_REPORT.md`,
and this report) — unchanged by writing the handler code itself. No
amount of code reading substitutes for that; this report intentionally
stops at "here is what the code now does," not "here is what happened
when it ran."

## Consolidated implication

The code-level gap `ESCROW_FLOW_AUDIT.md` and the original version of
this report found is closed. What remains is exactly what
`ESCROW_SANDBOX_TEST_REPORT.md` already lists as blocked: there is
still no way to prove any of this actually works end-to-end against
real Stripe test-mode events, because no test-mode credentials or
webhook endpoint exist in this project. The correct status for the
webhook work specifically is `ESCROW_CODE_HARDENED_NOT_TESTED`, not
`ESCROW_SANDBOX_VERIFIED` — that status is reserved for after the full
matrix in `ESCROW_SANDBOX_TEST_REPORT.md` actually passes against a
real Stripe object, a real webhook delivery, and the resulting database
row, together.
