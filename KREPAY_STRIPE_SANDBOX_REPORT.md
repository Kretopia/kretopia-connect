# KrePay — Stripe Sandbox Payment Matrix

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · updated 2026-08-24

**Status: NOT EXECUTED — BLOCKED_STRIPE_TEST_CONFIGURATION.**

Platform Stripe access is now available, but the connected credential is
**live-mode** — proven empirically (`GET /v1/products` → `"livemode": true`), not
inferred from a key name. There is no `STRIPE_SECRET_KEY_TEST`, no
`STRIPE_MODE`, and none of the three webhook signing secrets exist. Running the
matrix through the available credential would create **live** payment objects,
which this task forbids. Nothing was created.

## Matrix

| # | Case | Status |
|---|---|---|
| 1 | Successful payment | BLOCKED — needs test key |
| 2 | Declined card | BLOCKED |
| 3 | Canceled checkout | BLOCKED |
| 4 | Duplicate click | BLOCKED |
| 5 | Timeout + retry | BLOCKED |
| 6 | Duplicate webhook | BLOCKED — code path verified statically |
| 7 | Invalid signature | BLOCKED — code path verified statically |
| 8 | Wrong amount | BLOCKED |
| 9 | Wrong currency | BLOCKED |
| 10 | Unauthorized payer | BLOCKED |
| 11 | Unauthorized milestone | BLOCKED |
| 12 | Refresh after payment | BLOCKED |
| 13 | Expired session | BLOCKED |
| 14 | Processing state | BLOCKED |
| 15 | Refund | BLOCKED |
| 16 | Dispute | BLOCKED |

## Static verification performed instead

- All three handlers read `await req.text()` before any parsing and verify with
  `constructEventAsync` before touching state. No handler calls `req.json()` first.
- All three dedupe on `stripe_webhook_events.event_id`, returning 200 on `23505`.
  Retries and replays are therefore no-ops; out-of-order events are tolerated
  because each handler writes terminal state from the event payload rather than
  incrementing.
- Missing signature → 400. Bad signature → 400. Missing secret → fail closed.
- **New this pass:** `assertEventMatchesMode(event.livemode)` rejects a live event
  delivered to a test deployment and a test event delivered to a live one — cases
  "test event sent to a live secret" and "live event sent to a test secret" are
  now handled in code, pending live-fire confirmation.
- Offline signature tests already exist in
  `src/lib/__tests__/stripeWebhookSignature.test.ts` (valid, malformed header,
  tampered body, wrong secret, stale timestamp).

## To unblock
Provide `STRIPE_SECRET_KEY_TEST`, set `STRIPE_MODE=test`, and register the three
test endpoints with their own signing secrets (see
`STRIPE_WEBHOOK_ENDPOINT_MATRIX.md`). Then this matrix can run end to end,
recording per case: Stripe test object ID, event ID, endpoint, signature result,
DB state, KrePay UI state, audit row, notification result, duplicate result,
expected vs actual.
