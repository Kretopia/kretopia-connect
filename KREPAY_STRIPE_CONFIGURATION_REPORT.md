# KrePay — Stripe Configuration Report

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-23
**Status: BLOCKED_STRIPE_MODE — no PaymentIntent, Checkout Session, transfer or payout was created.**

## Cloud Secrets present (names only, no values read)
Payment-relevant:
- `STRIPE_SECRET_KEY` — present (one user secret + one platform-managed entry)

Payment-relevant secrets **absent**:
- `STRIPE_WEBHOOK_SECRET` — required by `guest-wallet-webhook`
- `STRIPE_WALLET_WEBHOOK_SECRET` — required by `stripe-wallet-webhook`
- `STRIPE_MARKETPLACE_WEBHOOK_SECRET` — required by `stripe-marketplace-webhook`
- No separate test-mode secret (`STRIPE_SECRET_KEY_TEST` or equivalent)

## Mode determination
| Item | Finding |
|---|---|
| Backend secret key mode | **UNKNOWN — cannot be confirmed as test.** Name-based inference is explicitly not accepted, and the value is never printed. Previous session recorded it as a **live** key. |
| Connected Stripe account (via platform Stripe tool) | `acct_1GweNPJvOS7zG18h` — "ThriveIN", standard live dashboard account |
| Webhook secret environment | none configured → signature verification is non-functional in every handler |
| Endpoint environment | no test-mode endpoint registered |
| Test object isolation | not established |

Because the required test-mode secret cannot be confirmed and **all three** webhook signing
secrets are missing, the sandbox matrix cannot legally run under the safety gate.

## Webhook handlers inventory
| Function | Secret it reads | Configured? |
|---|---|---|
| `stripe-wallet-webhook` | `STRIPE_WALLET_WEBHOOK_SECRET` | NO |
| `stripe-marketplace-webhook` | `STRIPE_MARKETPLACE_WEBHOOK_SECRET` | NO |
| `guest-wallet-webhook` | `STRIPE_WEBHOOK_SECRET` | NO |

All three already fail closed: a missing secret returns 500 "misconfigured" / equivalent and no
state is mutated.

## Frontend exposure check (VERIFIED)
- No Stripe secret key appears in `src/`. Client only invokes edge functions
  (`create-checkout`, `create-payment`, `create-invoice-checkout`, `wallet-*`).
- `.env` contains only Supabase URL + publishable key and the VAPID public key.

## Required manual actions to unblock (REQUIRES-MANUAL-ACTION)
1. Create/locate a **test-mode** restricted or standard secret key in Stripe and store it as
   `STRIPE_SECRET_KEY_TEST` (or switch the project to a sandbox account).
2. Register three **test-mode** webhook endpoints:
   - `https://kwmcocsitwssrtzkdojh.functions.supabase.co/stripe-wallet-webhook`
   - `https://kwmcocsitwssrtzkdojh.functions.supabase.co/stripe-marketplace-webhook`
   - `https://kwmcocsitwssrtzkdojh.functions.supabase.co/guest-wallet-webhook`
3. Save each endpoint's own signing secret under the matching name above.
4. Confirm test products/prices, then re-run this prompt's sections 4–6.
