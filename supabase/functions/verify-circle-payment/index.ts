import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-CIRCLE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { circleId, sessionId } = await req.json();
    if (!circleId) throw new Error("Circle ID is required");
    if (!sessionId) throw new Error("Session ID is required");

    logStep("Verifying payment", { circleId, userId: user.id, sessionId });

    // This previously updated circle_subscriptions to 'active' on a bare
    // client claim with no Stripe interaction at all — any authenticated
    // user could join any paid Circle for free. Retrieve and verify the
    // real Stripe session before granting access, same pattern as
    // verify-founder-payment / wallet-topup-confirm.
    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { status: session.payment_status, metadata: session.metadata });

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }
    if (session.metadata?.type !== "circle_subscription") {
      throw new Error("Invalid session type");
    }
    if (session.metadata?.circle_id !== circleId) {
      throw new Error("Session does not match this circle");
    }
    if (session.metadata?.buyer_id !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Update subscription status
    await supabaseAdmin
      .from('circle_subscriptions')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_subscription_id: sessionId || null,
      })
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .eq('status', 'pending');

    // Add user as member
    const { error: memberError } = await supabaseAdmin
      .from('spark_room_members')
      .upsert({
        room_id: circleId,
        user_id: user.id,
        role: 'member',
      }, { onConflict: 'room_id,user_id' });

    if (memberError) {
      logStep("Error adding member", { error: memberError });
    }

    logStep("Payment verified and member added");

    return new Response(JSON.stringify({ success: true }), {
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
