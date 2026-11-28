# Paddle go-live runbook (subscriptions only)

Order matters. **Stripe stays the live provider until step 9.** Nothing here moves money until a person completes a checkout; the live test uses a 100% discount.
Names only below: never paste a key, token or secret into a chat, a PR, a commit or a ticket. Production = the legacy backend (`kwmcocsitwssrtzkdojh`), changed only by a person pasting into the Lovable project `kretopia-app` (`docs/platform/DEPLOYMENT_RUNBOOK.md`, "Where things live").

## 0. Who does what
| Step | Who |
|---|---|
| 1-2, 5-6, 8 | CEO / account owner (Paddle dashboard) |
| 3-4, 7 | Whoever can paste into the Lovable `kretopia-app` project and set Edge Function secrets |
| 9-11 | Together, with the `paddle-live` MCP connected |

## 1. Paddle account (dashboard, live)
1. Business verification completed (Business > Verification). Checkout does not open before.
2. Website approval: submit the domain (Settings > Website approval). Wait for "approved".
3. Payment methods and sales tax / balance currency set as you want them live (Checkout settings; Settings > Sales tax; Settings > Currencies).
4. Payout bank details (Business account > Payouts).
5. A refund / cancellation policy page exists on the site and is linked from the footer and the pricing page. (Not in the repo yet: the text must come from the company.)

## 2. Catalog (live)
Create live products and prices that match the site exactly: 4 tiers × monthly/yearly = **8 prices** (Creator, Creator+, Brand Pro, Brand Enterprise). Prices must equal `src/lib/subscriptionConfig.ts` (Creator 29 / 278, Creator+ 59 / 566, Brand Pro 59 / 566, Brand Enterprise 129 / 1238, USD). Put the **7-day trial on the price** (Paddle applies it at price level; the Stripe code limited it to first-time subscribers, so decide whether repeat trials are acceptable).
Record the ids as `PADDLE_PRICE_<TIER>_<INTERVAL>`: tier ∈ PRO, CREATOR_PRO, BRAND_PRO, BRAND_ENTERPRISE; interval ∈ MONTHLY, YEARLY.

## 3. Database (paste, additive)
1. Open the production SQL editor. Paste `docs/security/PADDLE_BILLING_LEGACY_PASTE.sql` (idempotent: it adds 4 nullable columns and one deny-all ledger table; it changes no row).
2. Run the VERIFY queries at the bottom of the file. Expected: 4 columns, ledger with RLS and a deny policy, 0 client-writable columns, 0 members with a provider set.

## 4. Edge functions (paste into `kretopia-app`)
Compare each file with production's copy first (production is a hand-pasted copy and can differ); paste only if the only differences are ours.
| Function | Change | `verify_jwt` |
|---|---|---|
| `paddle-webhook` | new | **off** (Paddle sends no user JWT; the signature is the auth) |
| `create-checkout` | Paddle branch + tester list | keep current |
| `customer-portal` | Paddle portal for Paddle members | keep current |
| `check-subscription` | skips Stripe for Paddle members | keep current |
Shared files these import (paste with them): `_shared/paddleApi.ts`, `paddleCheckout.ts`, `paddleEntitlements.ts`, `paddleEnv.ts`, `paddleSignature.ts`, `paddleWebhook.ts`, `webhookLedger.ts`.
Check: `curl -i -X OPTIONS https://kwmcocsitwssrtzkdojh.supabase.co/functions/v1/paddle-webhook` returns 200. **Do not POST-probe** `paddle-webhook` (use Paddle's "send test event"). Logs show no new errors for 10 minutes.

## 5. Webhook destination (Paddle live)
Create one live notification destination, URL `https://kwmcocsitwssrtzkdojh.supabase.co/functions/v1/paddle-webhook`, events: `subscription.created`, `.activated`, `.trialing`, `.updated`, `.past_due`, `.paused`, `.resumed`, `.canceled`, `transaction.completed`, `transaction.payment_failed`. Copy its secret key into `PADDLE_WEBHOOK_SECRET` (step 6). Never delete or recreate it afterwards: that rotates the secret.

## 6. Edge Function secrets (production, names only)
`PADDLE_ENV=live`, `PADDLE_API_KEY` (live key, created in the dashboard), `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN` (`live_…`), the 8 `PADDLE_PRICE_*`.
**Leave `BILLING_PROVIDER` unset (= stripe).** Set `PADDLE_ALLOWED_USER_IDS` to your own user id only when you start step 9.

## 7. Front end (Lovable project `kretopia-app`, then Publish → Update)
Build variables: `VITE_PADDLE_CLIENT_TOKEN` (`live_…`), `VITE_PADDLE_ENV=live`. Merge the PR containing `/billing/checkout` and the Paddle.js opener first; no sandbox call remains in live (`Environment.set('sandbox')` runs only when the environment is `sandbox`).

## 8. Default payment link (Paddle dashboard)
Checkout > Checkout settings > Default payment link = `https://<approved domain>/billing/checkout`. The domain must already be approved and not localhost.

## 9. Open Paddle to testers only
Set `BILLING_PROVIDER=paddle` **and** `PADDLE_ALLOWED_USER_IDS=<your user id>`. Everyone else keeps Stripe. Pre-flight: a Stripe member still gets a Stripe checkout; your account gets a Paddle overlay.

## 10. Live test (zero cost)
1. Create a 100% discount (paddle-live MCP or dashboard) with a code.
2. You complete one checkout on the live domain with a real card and the code.
3. Verify: transaction `completed`; webhook deliveries 2xx (Paddle > Notifications); your `profiles` row has `subscription_provider='paddle'`, `paddle_customer_id`, `paddle_subscription_id`, tier from the price, status `active`/`trialing`, `subscription_event_at` set; the Subscription page shows the plan and "Manage billing"; `/thrivepay` shows the billing card.
4. Lifecycle: upgrade with `do_not_bill` (tier changes, no charge) → scheduled cancel at period end (still active) → immediate cancel (status `canceled`, tier `free`).
5. Clean up: subscription canceled, discount archived. (A $0 customer and subscription stay in the Paddle history.)

## 11. Open to customers
Only after step 10 passed and the Paddle domain/verification are approved: clear `PADDLE_ALLOWED_USER_IDS`, keep `BILLING_PROVIDER=paddle`. Existing Stripe subscribers are untouched (their provider stays empty); they manage billing in Stripe until you migrate them.

## Rollback
1. Set `BILLING_PROVIDER=stripe` (or unset it): new checkouts go back to Stripe at once.
2. Members already on Paddle keep their plan: it is stored on their profile, and `check-subscription` never downgrades them. Their billing portal stays Paddle's.
3. The SQL is additive: leave it in place. Do not delete the Paddle destination or the ledger table.

## Not covered (decide separately)
Migrating existing Stripe subscribers to Paddle; Paddle Retain (`pwCustomer`); Paddle IP allowlist for the webhook (the signature already authenticates every delivery); a grace period for `past_due` (access is paused immediately today).
