import { trustedReturnOrigin } from "../_shared/returnOrigin.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import {
  isKnownSubscriptionTier,
  resolveSubscriptionPriceId,
  type PriceInterval,
} from "../_shared/subscriptionPrices.ts";
import { corsFor } from '../_shared/guard.ts';
import { CheckoutRefusal, createPaddleCheckout } from "../_shared/paddleCheckout.ts";
import { providerForUser } from "../_shared/paddleEnv.ts";


serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { tier, interval } = await req.json();

    // BILLING_PROVIDER=paddle (optionally limited to PADDLE_ALLOWED_USER_IDS): the browser gets a transaction to open with Paddle.js; Stripe stays the default.
    if (providerForUser(Deno.env.toObject(), user.id) === "paddle") {
      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
      const { data: row, error: rowError } = await admin.from("profiles").select("subscription_tier, subscription_status, subscription_provider, stripe_customer_id").eq("user_id", user.id).maybeSingle();
      // Without the member's current billing state a second subscription cannot be ruled out: refuse rather than guess.
      if (rowError) throw new Error("Billing profile unavailable");
      try {
        const result = await createPaddleCheckout({
          env: Deno.env.toObject(), fetchFn: fetch as never, userId: user.id, tier, interval,
          existing: { tier: row?.subscription_tier ?? null, status: row?.subscription_status ?? null, provider: row?.subscription_provider ?? null, hasStripeCustomer: Boolean(row?.stripe_customer_id) },
        });
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      } catch (e) {
        if (e instanceof CheckoutRefusal) return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: e.status });
        throw e;
      }
    }
    if (!tier || !isKnownSubscriptionTier(tier)) throw new Error("Unknown or missing subscription tier");
    const normalizedInterval: PriceInterval = interval === "yearly" ? "yearly" : "monthly";
    // Resolved server-side (test vs. live) from STRIPE_MODE — never trust a
    // client-supplied Price ID, since the frontend has no visibility into
    // which Stripe mode the backend is running in.
    const priceId = resolveSubscriptionPriceId(tier, normalizedInterval);

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil" 
    });
    
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Check if this customer already had a subscription (no trial for returning users)
    let hadPreviousSub = false;
    if (customerId) {
      const prevSubs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
      });
      hadPreviousSub = prevSubs.data.length > 0;
    }

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${trustedReturnOrigin(req)}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${trustedReturnOrigin(req)}/payment-canceled`,
    };

    // Add 7-day free trial for new subscribers
    if (!hadPreviousSub) {
      sessionParams.subscription_data = {
        trial_period_days: 7,
      };
    }

    // Stable across retries of the same logical request: same user + tier +
    // interval + trial-eligibility resolve to the same key, so a client
    // retry (or an SDK-level network retry) reuses the original session
    // instead of opening a second one.
    const idempotencyKey = `subscription-checkout-${user.id}-${tier}-${interval}-${hadPreviousSub ? "resub" : "trial"}`;

    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
