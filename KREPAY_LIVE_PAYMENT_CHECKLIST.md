# KrePay — Live Payment Checklist (PREPARATION ONLY)

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-24
Live mode is **not** enabled by this document. No live payment may be created
without explicit, line-by-line approval from the owner.

## 1. Live secret names
| Name | Purpose | Configure when |
|---|---|---|
| `STRIPE_MODE=live` | Explicit mode selector | at live cutover |
| `STRIPE_SECRET_KEY_LIVE` | Live API key (falls back to existing `STRIPE_SECRET_KEY`) | at live cutover |
| `STRIPE_WALLET_WEBHOOK_SECRET` | Live signing secret, wallet endpoint | at live cutover |
| `STRIPE_MARKETPLACE_WEBHOOK_SECRET` | Live signing secret, marketplace endpoint | at live cutover |
| `STRIPE_WEBHOOK_SECRET` | Live signing secret, guest wallet endpoint | at live cutover |

Test and live signing secrets share these names, so **test and live must live in
separate Cloud environments** — never in the same one.

## 2. Live endpoints and events
Identical to `STRIPE_WEBHOOK_ENDPOINT_MATRIX.md`, registered in live mode,
including the same Connect scope decisions (wallet = connected accounts;
marketplace and guest = platform only).

## 3. Live account verification checklist
- [ ] Platform account renamed/branded Kretopia in Stripe.
- [ ] At least one connected account with `charges_enabled: true`.
- [ ] `capabilities.transfers: active`.
- [ ] `payouts_enabled: true`, `requirements.past_due` empty, no `disabled_reason`.
- [ ] A verified external bank account attached.
- [ ] The `rejected.fraud` appeal on `acct_1U4f5v2UG54RERl2` resolved or the
      account retired.

## 4. Controlled first-payment plan
1. Sandbox matrix fully green first (`STRIPE_SANDBOX_VERIFIED`).
2. Owner approves in writing, line by line.
3. One real charge, minimum viable amount, on a named test invoice with a real card.
4. Verify by the KrePay gate — not by the browser redirect: Stripe object
   succeeded, signature passed, event deduped, payment row updated, valid state
   transition, KrePay reflects server state, audit row exists, no duplicate
   charge or entitlement.
5. Refund that charge immediately (see §5) and confirm `charge.refunded` lands.

## 5. Refund plan
Refund from the Stripe dashboard or `create_refund`, then confirm the
`charge.refunded` event reaches `stripe-marketplace-webhook`, deduped, with the
local payment row moved to refunded and the entitlement revoked.

## 6. Monitoring plan
- Edge function logs for each webhook: signature failures, mode mismatches, 5xx.
- `stripe_webhook_events` row count per endpoint vs Stripe's delivery count.
- Stripe dashboard alerts on failed deliveries and disputes.
- Daily reconciliation of `creator_payouts` / payment rows against Stripe.

**Stop here. Explicit approval required before any live payment.**
