import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Product ID to tier mapping — consolidated 3-tier structure
// Pro ($29/mo) = website builder included
// Creator Pro ($59/mo) = custom domain, analytics, white-glove
const PRODUCT_TIER_MAP: Record<string, string> = {
  // Brand Enterprise (current monthly + yearly + legacy)
  'prod_UKAmQMESnSKqwB': 'brand_enterprise',
  'prod_UKAmq7dJi4lkBd': 'brand_enterprise',
  'prod_UDoT2jPlIxVnLp': 'brand_enterprise',
  // Brand Pro (current monthly + yearly + legacy)
  'prod_UKAmkngXKhLPdB': 'brand_pro',
  'prod_UKAmubvs5yP0o2': 'brand_pro',
  'prod_UDoSA9g7yHRm3X': 'brand_pro',
  // Creator Pro ($59/mo — formerly "Enterprise")
  'prod_UKAmUMW9FUQLZD': 'creator_pro',
  'prod_UKAl8dxTE4ZidO': 'creator_pro',
  'prod_U5VmCaKx7g2lbw': 'creator_pro',
  // Pro ($29/mo — formerly "Creator Pro")
  'prod_UKAmxFRvNL3ez3': 'pro',
  'prod_UKAlBEJxMen4Xr': 'pro',
  'prod_UKARjeRiOcTS46': 'pro',
  // Legacy $15 Pro products → grandfathered as Pro
  'prod_UKAmTywyqyLhMk': 'pro',
  'prod_UKAlwpY8dS3Doc': 'pro',
  'prod_TWc5tpvPKjy8hG': 'pro',
  'prod_TA5c8GtL6ioS2h': 'pro',
  'prod_TA5ihoppNqeijE': 'pro',
  'prod_TAoY7TiQaFLU00': 'pro',
  'prod_TAoZwx40t99jYc': 'pro',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = resolveStripeSecretKey();
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Fetch existing profile
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('user_id', user.id)
      .single();

    // Founder Circle members have lifetime access — never downgrade
    if (profileData?.subscription_tier === 'founder') {
      logStep("Founder Circle member detected, preserving lifetime access");
      return new Response(JSON.stringify({
        subscribed: true, tier: 'founder',
        product_id: 'prod_TzMqfksF7u6WBH', subscription_end: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found");
      const isComplimentary = profileData?.subscription_status === 'active' && 
        ['pro', 'creator_pro', 'brand_pro', 'brand_enterprise'].includes(profileData.subscription_tier);
      const isManualTrial = profileData?.subscription_status === 'trialing' && 
        ['pro', 'creator_pro', 'brand_pro', 'brand_enterprise'].includes(profileData.subscription_tier);
      
      if (isComplimentary || isManualTrial) {
        logStep("Complimentary/trial profile detected, skipping downgrade");
        return new Response(JSON.stringify({
          subscribed: false, tier: profileData.subscription_tier,
          product_id: null, subscription_end: null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      
      await supabaseClient.from('profiles').update({
        subscription_tier: 'free', subscription_status: 'none',
        subscription_product_id: null, subscription_end_date: null,
      }).eq('user_id', user.id);
      
      return new Response(JSON.stringify({ 
        subscribed: false, tier: 'free', product_id: null, subscription_end: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check all active and trialing subscriptions
    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 10 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 10 }),
    ]);

    const allSubs = [...activeSubs.data, ...trialingSubs.data];
    
    if (allSubs.length === 0) {
      logStep("No active subscription found");
      const isComplimentaryNoSub = profileData?.subscription_status === 'active' && 
        ['pro', 'creator_pro', 'brand_pro', 'brand_enterprise'].includes(profileData.subscription_tier);
      const isManualTrialNoSub = profileData?.subscription_status === 'trialing' && 
        ['pro', 'creator_pro', 'brand_pro', 'brand_enterprise'].includes(profileData.subscription_tier);
      
      if (isComplimentaryNoSub || isManualTrialNoSub) {
        return new Response(JSON.stringify({
          subscribed: false, tier: profileData.subscription_tier,
          product_id: null, subscription_end: null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      
      await supabaseClient.from('profiles').update({
        subscription_tier: 'free', subscription_status: 'none',
        subscription_product_id: null, subscription_end_date: null,
      }).eq('user_id', user.id);

      return new Response(JSON.stringify({
        subscribed: false, tier: 'free', product_id: null, subscription_end: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // Determine the highest tier from all active subscriptions
    const tierPriority: Record<string, number> = {
      'brand_enterprise': 6, 'creator_pro': 5, 'brand_pro': 3.5, 'pro': 3, 'free': 0,
    };
    
    let bestTier = 'free';
    let bestProductId: string | null = null;
    let bestSubEnd: string | null = null;
    let bestStatus = 'none';

    for (const sub of allSubs) {
      const productId = sub.items.data[0].price.product as string;
      const subTier = PRODUCT_TIER_MAP[productId] || 'free';
      
      // Migrate legacy "enterprise" tier to "creator_pro"
      const effectiveTier = subTier === 'enterprise' ? 'creator_pro' : subTier;
      
      if ((tierPriority[effectiveTier] || 0) > (tierPriority[bestTier] || 0)) {
        bestTier = effectiveTier;
        bestProductId = productId;
        bestStatus = sub.status;
        try {
          const periodEnd = sub.current_period_end;
          if (typeof periodEnd === 'number') bestSubEnd = new Date(periodEnd * 1000).toISOString();
          else if (typeof periodEnd === 'string') bestSubEnd = new Date(periodEnd).toISOString();
        } catch (e) { /* ignore date parse errors */ }
      }
    }
    
    logStep("Determined subscription tier", { bestTier, bestProductId, totalSubs: allSubs.length });
    
    await supabaseClient.from('profiles').update({
      subscription_tier: bestTier,
      subscription_status: bestStatus,
      subscription_product_id: bestProductId,
      subscription_end_date: bestSubEnd,
      stripe_customer_id: customerId,
    }).eq('user_id', user.id);

    return new Response(JSON.stringify({
      subscribed: true, tier: bestTier,
      product_id: bestProductId, subscription_end: bestSubEnd,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
