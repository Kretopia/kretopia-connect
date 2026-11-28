import { trustedReturnOrigin } from "../_shared/returnOrigin.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";


import { corsFor } from '../_shared/guard.ts';
import { assertPaddleEnv } from "../_shared/paddleEnv.ts";
import { createPortalSession } from "../_shared/paddleApi.ts";
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Paddle-managed members open Paddle's portal for the customer a verified webhook recorded; Stripe members keep Stripe's.
    const { data: billing } = await supabaseClient.from("profiles").select("subscription_provider, paddle_customer_id, paddle_subscription_id").eq("user_id", user.id).maybeSingle();
    if (billing?.subscription_provider === "paddle") {
      if (!billing.paddle_customer_id) throw new Error("No billing account found for this user");
      const env = Deno.env.toObject();
      const environment = assertPaddleEnv(env, { apiKey: true });
      const portal = await createPortalSession(fetch as never, environment, env.PADDLE_API_KEY as string, { customerId: billing.paddle_customer_id, subscriptionId: billing.paddle_subscription_id });
      return new Response(JSON.stringify({ url: portal.url, provider: "paddle" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // Everyone else (including Stripe members while both providers run) keeps Stripe's portal.
    const stripeKey = resolveStripeSecretKey();
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const origin = trustedReturnOrigin(req);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/subscription`,
    });
    logStep("Customer portal session created", { sessionId: portalSession.id, url: portalSession.url });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in customer-portal", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
