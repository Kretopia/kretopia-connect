import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { activateFounderPurchase, checkFounderSession, FOUNDER_BONUS_XP } from "../_shared/founderActivation.ts";


import { corsFor } from '../_shared/guard.ts';
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-FOUNDER-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
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

    // Paid, a Founder Circle session, and this caller's own. The session ID rides in the success-redirect URL
    // (create-founder-checkout's success_url), which can leak via browser history, a shared screenshot, or
    // referrer headers on the destination page: without the ownership check, anyone who obtained another
    // user's real paid session ID could call this function and be granted founder status on their payment.
    const check = checkFounderSession(session, user.id);
    if (!check.ok) {
      throw new Error(
        check.reason === "not_paid" ? "Payment not completed"
          : check.reason === "wrong_type" ? "Invalid session type"
          : "Session does not belong to this user",
      );
    }

    // One conditional claim of the purchase row, then the tier and the bonus: exactly once, however many
    // callers (two tabs, check-subscription's recovery) verify the same session at the same time.
    const activation = await activateFounderPurchase(supabaseAdmin, user.id, session);
    if (activation === "already_processed") {
      logStep("Already processed");
      return new Response(JSON.stringify({ success: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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
