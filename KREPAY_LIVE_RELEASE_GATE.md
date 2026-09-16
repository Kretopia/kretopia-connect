# KrePay — Live Release Gate

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · updated 2026-08-23
**Gate status: CLOSED — BLOCKED_STRIPE_DASHBOARD_ACCESS.**
Stripe LIVE mode was not enabled. No payment object of any kind was created.

## Gate matrix

| Gate condition | Status |
|---|---|
| Wallet security migration applied | PASS |
| Negative wallet tests pass (privilege matrix) | PASS |
| Privilege state stable (no drift) | PASS |
| Notification migration applied | PASS |
| acceptance → Studio → notification flow passes | PASS (12-case matrix) |
| Stripe secret inventory complete | PASS (`KREPAY_STRIPE_SECRET_INVENTORY.md`) |
| No Stripe secret in frontend / `.env` / Git history / build output | PASS |
| Webhook handlers read raw body before parsing | PASS (all 3) |
| Webhook handlers fail closed on invalid signature | PASS (all 3) |
| Webhook handlers fail closed on missing secret | PASS (all 3) |
| Database event-ID deduplication on all webhook handlers | PASS (all 3) |
| Automated signature / replay / dedupe tests | PASS (9/9, offline) |
| Server-side amount & currency derivation | PASS |
| Payer / project / milestone authorization | PASS |
| Stripe idempotency keys on Checkout Session creation | **FAIL — missing on 5 session creators** |
| Test-mode Stripe key configured (`STRIPE_SECRET_KEY_TEST`) | NOT CONFIGURED |
| Test webhook endpoints registered | NOT CONFIGURED |
| Test webhook signing secrets stored | NOT CONFIGURED |
| Sandbox payment matrix executed | NOT RUN (blocked) |
| Live/test key mode separation | **FAIL — one secret name serves both modes** |
| Live webhook endpoints exist | NOT CONFIGURED |
| Live webhook secrets match live endpoints | NOT CONFIGURED |
| Production URLs verified | PASS (`https://kretopia.com`, `https://www.kretopia.com`) |
| Payout / Connect configuration complete | PARTIAL — stack exists, unverified end-to-end |
| Human approval for a live charge recorded | NOT RECORDED |

## Ordered path to open the gate
1. Stripe account owner recovers Dashboard access.
2. Owner completes `KREPAY_STRIPE_DASHBOARD_RUNBOOK.md` sections B–E (test mode only).
3. Engineering adds mode separation: functions prefer `STRIPE_SECRET_KEY_TEST` when the
   project is in test mode, so a live key can never serve a sandbox run.
4. Engineering adds deterministic `idempotencyKey` values to the five Checkout Session
   creators (`create-payment`, `create-connect-payment`, `create-invoice-checkout`,
   `create-milestone-payment`, `create-payment-link-checkout`).
5. Run the full sandbox matrix (success, decline, 3DS, refund, duplicate delivery,
   replay, out-of-order, Connect payout) and record results.
6. Only after 1–5 are green: register live endpoints, store live signing secrets, and
   obtain a separate, explicit, written human approval for a first controlled live charge
   (proposal: 1.00 USD, dedicated internal account, refunded within 10 minutes).

A live charge must never be executed from an automated prompt.
