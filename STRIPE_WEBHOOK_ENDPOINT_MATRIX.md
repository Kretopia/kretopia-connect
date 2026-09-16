# Stripe Webhook Endpoint Matrix

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-24

Base URL for deployed functions:
`https://kwmcocsitwssrtzkdojh.functions.supabase.co/<function>`

Registered in Stripe today: **none** (`GET /v1/webhook_endpoints` → empty, live mode).

## Endpoints to register in TEST mode

| # | Function / URL | Events | Cloud Secret for signing key | Connect scope |
|---|---|---|---|---|
| 1 | `stripe-wallet-webhook` | `account.updated`, `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `balance.available` | `STRIPE_WALLET_WEBHOOK_SECRET` | **Connected accounts required.** The handler matches on `creator_wallets.stripe_account_id` and `creator_payouts.stripe_payout_id`; payouts and balances live on the connected Express accounts, not the platform. Register with "Listen to events on connected accounts" enabled. |
| 2 | `stripe-marketplace-webhook` | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.processing`, `charge.refunded`, `charge.dispute.created` | `STRIPE_MARKETPLACE_WEBHOOK_SECRET` | **Platform account only.** All marketplace Checkout Sessions are created on the platform with `application_fee` / destination charges, so the events are emitted by the platform. Do not enable connected-account delivery here: it would duplicate every event and, since the handler dedupes by event ID only, produce two distinct event IDs for one payment. |
| 3 | `guest-wallet-webhook` | `checkout.session.completed`, `checkout.session.async_payment_succeeded` | `STRIPE_WEBHOOK_SECRET` | **Platform account only.** Guest top-ups are platform Checkout Sessions carrying `metadata.kind = guest_wallet_topup`. |

Rules enforced:
- One unique signing secret per endpoint. Reuse is not acceptable.
- A live signing secret must never be stored under a test-mode name.
- `assertEventMatchesMode(event.livemode)` now rejects any cross-mode delivery
  even if a secret is misfiled.

## Handler verification status (static, not yet sandbox-executed)

| Requirement | wallet | marketplace | guest |
|---|---|---|---|
| Raw body read before parsing | yes | yes | yes |
| Signature verified before state change | yes | yes | yes |
| Missing secret → fail closed | 500 | 500 | 400 |
| Missing/invalid signature → 400 | yes | yes | yes |
| Dedupe by event ID (`stripe_webhook_events`, 23505 → 200) | yes | yes | yes |
| Cross-mode event rejected | yes (new) | yes (new) | yes (new) |
| Secrets / full payment data logged | no | no | no |
