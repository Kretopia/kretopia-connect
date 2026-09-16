# Stripe Platform Access Report

Project: Kretopia · Lovable Cloud ref `kwmcocsitwssrtzkdojh` · 2026-08-24

## Access obtained
| Item | Result |
|---|---|
| Platform Stripe tool | Connected — account `acct_1GweNPJvOS7zG18h` ("ThriveIN") |
| API access mode | **LIVE.** Verified empirically, not by name: `GET /v1/products` returns objects with `"livemode": true`. |
| Test-mode API access | **Not available.** The connected credential is a live-mode key; every object it can read or create is a live object. |
| Webhook endpoints registered (live) | **0** — `GET /v1/webhook_endpoints` returns an empty list. |

## Consequence for this task
Creating the three webhook endpoints through this tool would create **live-mode**
endpoints, which the task explicitly forbids. No endpoint, product, price,
PaymentIntent, Checkout Session, transfer, payout or refund was created.

Reads performed (non-mutating, no secret values printed): account info, product
list (mode probe), webhook endpoint list, connected account list.

## Cloud Secrets present (names only)
Stripe-relevant:
- `STRIPE_SECRET_KEY` — present (live; one user secret + one platform-managed entry)

Absent:
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_MODE`
- `STRIPE_WALLET_WEBHOOK_SECRET`
- `STRIPE_MARKETPLACE_WEBHOOK_SECRET`
- `STRIPE_WEBHOOK_SECRET`

## Code baseline
- 37 edge functions constructed a Stripe client from an ambiguous `STRIPE_SECRET_KEY`.
  All 37 now resolve the key through `supabase/functions/_shared/stripeEnv.ts`
  (see `STRIPE_TEST_CONFIGURATION_REPORT.md`).
- Frontend (`src/`) contains no Stripe secret; the client only invokes edge
  functions. `.env` holds Supabase URL + publishable key + VAPID public key only.

**Status: BLOCKED_STRIPE_TEST_CONFIGURATION** — test-mode credentials must be
supplied before any sandbox execution.
