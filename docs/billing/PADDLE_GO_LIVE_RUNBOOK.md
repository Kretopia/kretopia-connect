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

## 4. Edge functions (paste into `kretopia-app`) — READ THE DRIFT FINDINGS FIRST
Production's copies are **older than `main`** (compared read-only on 2026-11-28 against the Lovable project `kretopia-app`). Do not overwrite them wholesale.

| Finding in production | Consequence |
|---|---|
| `create-checkout` still expects `{ priceId }` and checks `isAllowedSubscriptionPrice`; the published front end already sends `{ tier, interval }` (confirmed in the live `Subscription` chunk) | **Stripe subscription checkout is probably failing today** with "Unknown subscription price". Test it (step 4.0). The repo version fixes it. |
| `_shared/returnOrigin.ts` and `_shared/subscriptionPrices.ts` do not exist in production | The repo `create-checkout` cannot boot without them: paste both. |
| `_shared/webhookLedger.ts` is an older version that the Stripe webhooks depend on (it throws instead of returning "unavailable") | **Do not overwrite it.** The Paddle webhook uses its own `_shared/paddleLedger.ts`. |
| `check-subscription` still calls `recoverPendingFounderPurchase`, has no 401 on invalid sessions and a wildcard CORS | The repo version removed Founder recovery (it assumes Founder is activated by a verified payment webhook). **Do not paste the repo version**; add only the Paddle block below. |
| `customer-portal` falls back to `https://www.thrivein.io` and has no trusted-origin check | Add only the Paddle block below. |

**4.0 Check Stripe checkout today.** Signed in as a Free test account on the live site, click a paid plan. If you see an error toast ("Unknown subscription price"), checkout is broken independently of Paddle; steps 4.1-4.2 fix it. (It creates a Stripe session but no charge unless you pay.)

**4.1 New files (safe to add, nothing depends on them yet):** `_shared/paddleApi.ts`, `paddleCheckout.ts`, `paddleEntitlements.ts`, `paddleEnv.ts`, `paddleLedger.ts`, `paddleSignature.ts`, `paddleWebhook.ts`; and the new function `paddle-webhook` (`index.ts`). `verify_jwt` **off** for `paddle-webhook` only.

**4.2 Replace `create-checkout`** with the repo version, together with `_shared/returnOrigin.ts` and `_shared/subscriptionPrices.ts`. Before pasting, confirm the live Stripe price ids in `subscriptionPrices.ts` are the ones you sell, and that `STRIPE_MODE` is `live` (or the `STRIPE_PRICE_*_TEST` variables exist).

**4.3 `check-subscription`: add only this block** in production's version, right after the Founder early-return and before `const stripe = new Stripe(...)`, plus `import { grantsAccess } from "../_shared/paddleEntitlements.ts";`:
```ts
const { data: billing } = await supabaseClient.from('profiles')
  .select('subscription_provider, subscription_product_id, subscription_end_date')
  .eq('user_id', user.id).maybeSingle();
if (billing?.subscription_provider === 'paddle') {
  return new Response(JSON.stringify({
    subscribed: grantsAccess(profileData?.subscription_status), tier: profileData?.subscription_tier ?? 'free',
    status: profileData?.subscription_status ?? 'none', provider: 'paddle',
    product_id: billing.subscription_product_id ?? null, subscription_end: billing.subscription_end_date ?? null,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
}
```
**4.4 `customer-portal`: add only this block** after the user is authenticated and before the Stripe customer lookup, plus `import { assertPaddleEnv } from "../_shared/paddleEnv.ts"; import { createPortalSession } from "../_shared/paddleApi.ts";`:
```ts
const { data: billing } = await supabaseClient.from("profiles")
  .select("subscription_provider, paddle_customer_id, paddle_subscription_id").eq("user_id", user.id).maybeSingle();
if (billing?.subscription_provider === "paddle") {
  if (!billing.paddle_customer_id) throw new Error("No billing account found for this user");
  const env = Deno.env.toObject();
  const portal = await createPortalSession(fetch as never, assertPaddleEnv(env, { apiKey: true }), env.PADDLE_API_KEY as string,
    { customerId: billing.paddle_customer_id, subscriptionId: billing.paddle_subscription_id });
  return new Response(JSON.stringify({ url: portal.url, provider: "paddle" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
}
```
Check: `curl -i -X OPTIONS https://kwmcocsitwssrtzkdojh.supabase.co/functions/v1/paddle-webhook` returns 200. **Do not POST-probe** `paddle-webhook` (use Paddle's "send test event"). Logs show no new errors for 10 minutes. Production Stripe webhooks are untouched by this step.

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
