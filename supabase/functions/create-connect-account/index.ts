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
  console.log(`[CREATE-CONNECT-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Validate Stripe key before proceeding
    const stripeKey = resolveStripeSecretKey();
    
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not configured");
      return new Response(JSON.stringify({
        error: "Stripe not configured",
        message: "STRIPE_SECRET_KEY is not set. Please add it in your secrets.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Log key type for debugging (restricted keys work if Connect permissions are enabled)
    if (stripeKey.startsWith("rk_")) {
      logStep("Using restricted key - ensure Connect permissions are enabled in Stripe Dashboard");
    }

    // Check for publishable key used by mistake
    if (stripeKey.startsWith("pk_")) {
      logStep("ERROR: Publishable key detected");
      return new Response(JSON.stringify({
        error: "Invalid Stripe key type",
        message: "You're using a publishable key (pk_*). Please use the secret key (sk_*) instead.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Stripe key validated");

    // Use anon key for auth verification
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    
    // Use service role key for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user?.email) {
      throw new Error("User not authenticated");
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user already has a Connect account (use admin to bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id, stripe_account_status, full_name")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      logStep("Error fetching profile", { error: profileError.message });
    }

    if (profile?.stripe_account_id && profile?.stripe_account_status === 'active') {
      logStep("User already has active Connect account", { accountId: profile.stripe_account_id });
      return new Response(JSON.stringify({ 
        accountId: profile.stripe_account_id,
        status: 'active',
        message: 'Account already connected'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // Create or retrieve Stripe Connect Express account
    let accountId = profile?.stripe_account_id;

    if (!accountId) {
      logStep("Creating new Stripe Connect account");
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          user_id: user.id,
          full_name: profile?.full_name || 'Kretopia User',
        },
      });

      accountId = account.id;
      logStep("Stripe Connect account created", { accountId });

      // Save account ID to profile (use admin to bypass RLS)
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ 
          stripe_account_id: accountId,
          stripe_account_status: 'pending'
        })
        .eq("user_id", user.id);

      if (updateError) {
        logStep("ERROR: Failed to save account ID to profile", { error: updateError.message });
      } else {
        logStep("Account ID saved to profile");
      }
    }

    // Create account link for onboarding
    const origin = req.headers.get("origin") || "https://www.thrivein.io";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/thrivepay`,
      return_url: `${origin}/thrivepay?success=true`,
      type: 'account_onboarding',
    });

    logStep("Account onboarding link created", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      accountId,
      status: 'pending'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
