# KrePay — Webhook Test Plan

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-23
**These tests run entirely offline. They do not contact Stripe and use no real key.**

## 1. Automated suite (implemented, passing)

- Module under test: `supabase/functions/_shared/stripeSignature.ts`
  (pure Web Crypto; identical semantics in Deno and Vitest).
- Tests: `src/lib/__tests__/stripeWebhookSignature.test.ts`
- Command: `bunx vitest run src/lib/__tests__/stripeWebhookSignature.test.ts`
- Result: **9 / 9 passing.**

| # | Case | Expected | Status |
|---|---|---|---|
| 1 | Valid signature fixture | accepted, payload parsed | PASS |
| 2 | Missing `Stripe-Signature` header | rejected `missing_signature_header` | PASS |
| 3 | Malformed header | rejected `malformed_signature_header` | PASS |
| 4 | Invalid signature value | rejected `signature_mismatch` | PASS |
| 5 | Altered body, correct secret | rejected `signature_mismatch` | PASS |
| 6 | Wrong endpoint secret | rejected `signature_mismatch` | PASS |
| 7 | Replay outside tolerance (t−3600s) | rejected `timestamp_outside_tolerance` | PASS |
| 8 | Duplicate event ID | second delivery skipped, ledger size 1 | PASS |
| 9a | Safe retry (3 deliveries) | processed once, then skipped | PASS |
| 9b | Out-of-order delivery (`charge.refunded` before `payment_intent.succeeded`) | both recorded once, re-delivery is a no-op | PASS |

Every failure path returns before any payload is parsed or state is touched — the
helper fails closed by construction.

## 2. Static verification of the deployed handlers

| Handler | Raw body read before parse | Fails closed on missing secret | Fails closed on bad signature | DB event-ID dedupe |
|---|---|---|---|---|
| `stripe-wallet-webhook` | `await req.text()` before `constructEventAsync` — YES | 500 "misconfigured" — YES | 400 "bad sig" — YES | `stripe_webhook_events` unique insert, 23505 → 200 no-op — YES |
| `stripe-marketplace-webhook` | `await req.text()` before `constructEventAsync` — YES | 500 on missing `STRIPE_MARKETPLACE_WEBHOOK_SECRET` — YES | 400 — YES | event-ID dedupe added — YES |
| `guest-wallet-webhook` | `await req.text()` before `constructEventAsync` — YES | 500 on missing `STRIPE_WEBHOOK_SECRET` — YES | 400 — YES | `stripe_webhook_events` — YES |

No handler calls `req.json()` on a webhook request; the raw string is always what is
signature-checked, so no re-serialisation can invalidate or launder a signature.

## 3. Payment state machine, amounts and authorization (reviewed)

- **Amount/currency derivation:** server-side only. `create-milestone-payment` explicitly
  loads `milestones.amount` from the database with the service role and ignores the
  client-supplied `amount`; `create-invoice-checkout` derives cents from
  `invoices.total_amount` + `invoices.currency` and rejects quotes, already-paid invoices
  and sub-50-cent totals. Platform fees are computed from the server-read subscription
  tier, never from the request body.
- **Authorization:** `create-connect-payment` and the milestone functions authenticate the
  caller via the JWT before any Stripe call and stamp `payer_id` / `project_id` /
  `milestone_id` into PaymentIntent metadata. `_shared/escrowAuth.ts` enforces that only
  the recorded payer (or, absent metadata, the project's paying client / owner) may
  capture or cancel escrow, and `loadMilestoneForIntent` requires the milestone row to
  actually match the PaymentIntent ID.
- **State transitions:** the frontend never marks anything paid. Paid/failed/refunded and
  payout/KYC state are written exclusively by webhook handlers using the service role,
  and only after signature verification.
- **Stripe idempotency keys:** present on the payout/transfer path
  (`thrivefund-release-milestone`, `thrivefund-finalize-campaign`,
  `thrivefund-create-pledge`). **Gap:** the Checkout Session creators
  (`create-payment`, `create-connect-payment`, `create-invoice-checkout`,
  `create-milestone-payment`, `create-payment-link-checkout`) do not pass an
  `idempotencyKey`. A double-click can create two sessions. Recommended before the
  sandbox run: pass a deterministic key such as
  `milestone-${milestoneId}-${userId}` / `invoice-${invoice_id}`.

## 4. Cases that CANNOT be executed yet

The following require a Stripe test-mode key plus the three test signing secrets and are
therefore **not run and not claimed**:
successful test payment, failed card, refund, real duplicate delivery from Stripe,
Stripe CLI signature replay, Connect payout, and the end-to-end KrePay balance reflection.
