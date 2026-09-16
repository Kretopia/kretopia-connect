# KrePay — Stripe Dashboard Runbook (test mode first)

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-23
**Status: cannot be executed — Stripe Dashboard access is unavailable.**
This document is the exact human procedure for the Stripe account owner once access is
recovered. Every step is manual. No automated agent may perform them.

## A. Prerequisites
- Stripe Dashboard login recovered, with 2FA restored.
- Confirmation of which Stripe account Kretopia should use (previously recorded:
  `acct_1GweNPJvOS7zG18h`, "ThriveIN", live standard account).
- Do not paste any secret into chat, a code file, a screenshot or a ticket. Values go
  only into the Lovable Cloud secret form.

## B. Test-mode key
1. In the Stripe Dashboard, switch the toggle to **Test mode**.
2. Go to **Developers → API keys**.
3. Reveal the **test** secret key (`sk_test_…`) or create a restricted test key with
   write access to Checkout Sessions, PaymentIntents, Customers, Connect accounts,
   Transfers and Payouts.
4. Copy the value.
5. Save it in Lovable Cloud as **`STRIPE_SECRET_KEY_TEST`**.

## C. Test-mode webhook endpoints
Still in **Test mode**, go to **Developers → Webhooks → Add endpoint** and create three
separate endpoints:

| # | Endpoint URL | Events to select |
|---|---|---|
| 1 | `https://kwmcocsitwssrtzkdojh.functions.supabase.co/stripe-wallet-webhook` | `account.updated`, `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`, `balance.available` |
| 2 | `https://kwmcocsitwssrtzkdojh.functions.supabase.co/stripe-marketplace-webhook` | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `transfer.created` |
| 3 | `https://kwmcocsitwssrtzkdojh.functions.supabase.co/guest-wallet-webhook` | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` |

For each endpoint, open it, click **Reveal** under *Signing secret*, and copy the value.
Each endpoint has its **own** secret — do not reuse one value across endpoints.

## D. Lovable Cloud secret names (exact)
Save each copied value under exactly these names:

| Value copied from | Lovable Cloud secret name |
|---|---|
| Test secret API key | `STRIPE_SECRET_KEY_TEST` |
| Endpoint 1 signing secret | `STRIPE_WALLET_WEBHOOK_SECRET` |
| Endpoint 2 signing secret | `STRIPE_MARKETPLACE_WEBHOOK_SECRET` |
| Endpoint 3 signing secret | `STRIPE_WEBHOOK_SECRET` |

Leave the existing `STRIPE_SECRET_KEY` untouched.

## E. Test products / prices
1. In Test mode, **Products → Add product** for each paid plan and any fixed-price item.
2. Record the test `price_…` IDs and hand them to the team; do not overwrite live price
   IDs in configuration.

## F. Test cards to use in the sandbox matrix
| Scenario | Card |
|---|---|
| Success | `4242 4242 4242 4242` |
| Declined | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| 3DS required | `4000 0027 6000 3184` |
Any future expiry, any CVC, any postcode.

## G. Handover
Reply "test secrets saved" once D is complete. Only then may the sandbox matrix in
`KREPAY_WEBHOOK_TEST_PLAN.md` §4 be executed.

## H. Live mode — DO NOT DO YET
Live endpoints, live signing secrets and any live charge are deliberately out of scope
until every gate in `KREPAY_LIVE_RELEASE_GATE.md` is green and a separate, explicit human
approval is recorded.
