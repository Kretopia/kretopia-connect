# KrePay — Stripe Secret Inventory

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-23
**No secret value was read, printed or logged. Names only.**

## 1. Secret names referenced by the codebase

| Cloud Secret name | Purpose | Currently configured? |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe API calls (all payment functions) | Present — **mode previously recorded as LIVE, unusable for testing** |
| `STRIPE_WALLET_WEBHOOK_SECRET` | Signature verification for `stripe-wallet-webhook` | **Missing** |
| `STRIPE_MARKETPLACE_WEBHOOK_SECRET` | Signature verification for `stripe-marketplace-webhook` | **Missing** |
| `STRIPE_WEBHOOK_SECRET` | Signature verification for `guest-wallet-webhook` | **Missing** |

Required additional name for sandbox work (not yet created):

| Cloud Secret name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY_TEST` | Test-mode secret key, kept separate from the live key |

> Mode separation gap: today a single `STRIPE_SECRET_KEY` name serves both modes.
> Introducing `STRIPE_SECRET_KEY_TEST` (and having functions prefer it when
> `STRIPE_MODE=test`) is the recommended fix before any sandbox run.

## 2. Functions that read `STRIPE_SECRET_KEY`

`batch-milestone-payout`, `capture-milestone-payment`, `check-connect-status`,
`check-subscription`, `checkout-event-tickets`, `checkout-stage-ticket`,
`complete-product-purchase`, `create-checkout`, `create-connect-account`,
`create-connect-login-link`, `create-connect-payment`, `create-founder-checkout`,
`create-invoice-checkout`, `create-milestone-payment`, `create-payment-link-checkout`,
`create-payment`, `customer-portal`, `get-connect-balance`, `get-payment-intent`,
`guest-wallet-topup`, `guest-wallet-webhook`, `join-paid-circle`,
`purchase-digital-product`, `purchase-event-ticket`, `release-escrow`,
`stripe-marketplace-webhook`, `stripe-wallet-webhook`, `thrivefund-create-pledge`,
`thrivefund-finalize-campaign`, `thrivefund-release-milestone`, `verify-circle-payment`,
`verify-event-ticket`, `verify-founder-payment`, `verify-stage-ticket`,
`wallet-add-bank`, `wallet-balance`, `wallet-payout`, `wallet-topup`,
`wallet-topup-confirm` — **39 functions**.

## 3. Functions that read a webhook signing secret

| Function | Secret read | Endpoint path |
|---|---|---|
| `stripe-wallet-webhook` | `STRIPE_WALLET_WEBHOOK_SECRET` | `/stripe-wallet-webhook` |
| `stripe-marketplace-webhook` | `STRIPE_MARKETPLACE_WEBHOOK_SECRET` | `/stripe-marketplace-webhook` |
| `guest-wallet-webhook` | `STRIPE_WEBHOOK_SECRET` | `/guest-wallet-webhook` |

Each endpoint has its own distinct signing secret. Reusing one value across all three
endpoints is not acceptable — it weakens endpoint isolation.

## 4. Exposure check (VERIFIED)

| Surface | Result |
|---|---|
| Frontend (`src/`) | **Clean.** Only fee-percentage copy mentions Stripe. No key, no `sk_`/`whsec_` literal. The client only invokes edge functions. |
| `.env` / `index.html` | **Clean.** Supabase URL + publishable key + VAPID public key only. |
| Repository-wide literal scan (`sk_live`, `sk_test`, `whsec_`) | **No key literals found** outside the local test fixtures in `src/lib/__tests__/stripeWebhookSignature.test.ts`, which are non-Stripe strings used purely as HMAC inputs. |
| Git history (`git log -S`) | Two commits touch strings matching `sk_live`, both in `create-connect-account` error/help text. **No key value is present in any tracked revision.** |
| Build output (`dist/`) | Not present in the working tree; nothing to leak. Secrets are read server-side via `Deno.env`, so they cannot enter a Vite bundle by construction. |
| Function logs | Handlers log step names and IDs only. No `Deno.env.get("STRIPE_*")` value is ever passed to `console.log`. |

## 5. Residual risks
- Single-name key (`STRIPE_SECRET_KEY`) serves both modes — no mode separation.
- Three webhook signing secrets are missing, so all three handlers currently fail closed
  and process nothing.
- `acct_1GweNPJvOS7zG18h` is a live standard account; a sandbox account or test-mode
  toggle must be confirmed by the owner.
