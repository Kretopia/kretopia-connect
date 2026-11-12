import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { isStageTicketSession } from "../_shared/stageTicket.ts";


import { corsFor, safeError } from '../_shared/guard.ts';
import { publicPerimeter } from '../_shared/publicPerimeter.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    try {
      await publicPerimeter(req, "verify-stage-ticket", 10);
    } catch (perimeterError) {
      return safeError(perimeterError, req);
    }
    const stripeKey = resolveStripeSecretKey();
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Not authenticated");

    const body = await req.json().catch(() => null);
    const session_id = typeof body?.session_id === "string" ? body.session_id : "";
    if (!session_id) throw new Error("session_id required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ paid: false, status: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Read-only: fulfillment happens only in the signature-verified Stripe webhook.
    if (!isStageTicketSession(session.metadata as Record<string, string> | null)) throw new Error("Missing metadata");
    const stageId = session.metadata!.stage_id;
    if (session.metadata!.user_id !== user.id) throw new Error("Buyer mismatch");
    const { data: rsvp } = await admin.from("curated_stage_rsvps")
      .select("status").eq("stage_id", stageId).eq("user_id", user.id).maybeSingle();
    const seated = !!rsvp && rsvp.status === "rsvp";
    return new Response(JSON.stringify(seated ? { paid: true } : { paid: true, pending: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: seated ? 200 : 202,
    });
  } catch (e) {
    console.error("[verify-stage-ticket]", e);
    return new Response(JSON.stringify({ error: "Could not verify the ticket" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
