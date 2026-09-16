import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FOUNDER_BONUS_XP = 5000;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-FOUNDER-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // Verify the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { status: session.payment_status, metadata: session.metadata });

    if (session.payment_status !== 'paid') {
      throw new Error("Payment not completed");
    }

    // Verify this is a founder circle purchase
    if (session.metadata?.type !== 'founder_circle') {
      throw new Error("Invalid session type");
    }

    // The session ID rides in the success-redirect URL (create-founder-checkout's
    // success_url), which can leak via browser history, a shared screenshot, or
    // referrer headers on the destination page. Without this check, anyone who
    // obtained another user's real paid session ID could call this function
    // themselves and be granted founder status on someone else's payment.
    if (session.metadata?.user_id !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    // Check if already processed
    const { data: existing } = await supabaseAdmin
      .from('founder_circle_purchases')
      .select('status')
      .eq('stripe_session_id', sessionId)
      .single();

    if (existing?.status === 'completed') {
      logStep("Already processed");
      return new Response(JSON.stringify({ success: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Update purchase record
    await supabaseAdmin
      .from('founder_circle_purchases')
      .update({
        status: 'completed',
        stripe_payment_intent_id: session.payment_intent as string,
        purchased_at: new Date().toISOString(),
      })
      .eq('stripe_session_id', sessionId);

    // Update user profile to founder tier (lifetime)
    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_tier: 'founder',
        subscription_status: 'active',
        subscription_product_id: 'prod_TzMqfksF7u6WBH',
        subscription_end_date: null, // lifetime = no end date
      })
      .eq('user_id', user.id);

    // Award bonus XP
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('xp')
      .eq('user_id', user.id)
      .single();

    await supabaseAdmin
      .from('profiles')
      .update({ xp: (profile?.xp || 0) + FOUNDER_BONUS_XP })
      .eq('user_id', user.id);

    // Record XP activity
    await supabaseAdmin
      .from('xp_activities')
      .insert({
        user_id: user.id,
        activity_type: 'founder_circle',
        xp_earned: FOUNDER_BONUS_XP,
        description: 'Welcome to the Founder Circle! ⭕',
      });

    logStep("Founder Circle activation complete", { userId: user.id });

    return new Response(JSON.stringify({ success: true, bonus_xp: FOUNDER_BONUS_XP }), {
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
