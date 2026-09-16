# KrePay — Release Gate

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · updated 2026-08-24

## FINAL STATUS: BLOCKED_STRIPE_TEST_CONFIGURATION
Secondary, independently blocking: **BLOCKED_CONNECT_PAYOUTS**.

## Gate summary

| Gate | Result |
|---|---|
| Platform Stripe access | AVAILABLE — `acct_1GweNPJvOS7zG18h`, **live-mode credential** (`livemode: true` observed) |
| Test-mode credential | **MISSING** — `STRIPE_SECRET_KEY_TEST` not configured |
| Mode separation in code | **DONE** — `_shared/stripeEnv.ts`, 37 functions migrated, cross-mode key and event guards fail closed |
| Test webhook endpoints | **NOT REGISTERED** — 0 endpoints exist; creating them with the available credential would create live endpoints |
| Webhook signing secrets | **ALL THREE MISSING** — handlers fail closed and process nothing |
| Webhook security (static) | PASS — raw body, verify-before-state, dedupe by event ID, 400 on bad/missing signature, no secret logging |
| Connect payouts | **BLOCKED** — `transfers` inactive, `payouts_enabled` false, one account `rejected.fraud`, no bank attached |
| Sandbox matrix | NOT EXECUTED |
| Live payments | NOT ATTEMPTED — forbidden by this task |
| Frontend secret exposure | PASS — no Stripe secret in `src/` or `.env` |

## Objects created during this task
None. No PaymentIntent, Checkout Session, product, price, webhook endpoint,
transfer, payout, refund or payment email. No production financial data modified.

## Next gate transition
`BLOCKED_STRIPE_TEST_CONFIGURATION → READY_FOR_STRIPE_SANDBOX` requires:
1. `STRIPE_SECRET_KEY_TEST` stored in Cloud Secrets.
2. `STRIPE_MODE=test` on the sandbox environment.
3. Three test-mode endpoints registered, each with its own signing secret stored
   under `STRIPE_WALLET_WEBHOOK_SECRET`, `STRIPE_MARKETPLACE_WEBHOOK_SECRET`,
   `STRIPE_WEBHOOK_SECRET`.

`READY_FOR_MANUAL_LIVE_APPROVAL` additionally requires `STRIPE_SANDBOX_VERIFIED`
and the Connect blockers in `STRIPE_CONNECT_ACCOUNT_STATUS_REPORT.md` cleared.
