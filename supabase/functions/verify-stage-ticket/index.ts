import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { canEnterStage, entryWasChecked, isStageTicketSession } from "../_shared/stageTicket.ts";


import { corsFor } from '../_shared/guard.ts';
import { publicPerimeter } from '../_shared/publicPerimeter.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await publicPerimeter(req, "verify-stage-ticket", 10);
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

    // Only a session this program created for a stage ticket is a ticket.
    if (!isStageTicketSession(session.metadata as Record<string, string> | null)) throw new Error("Missing metadata");
    const stageId = session.metadata!.stage_id;
    const buyerId = session.metadata!.user_id;
    if (buyerId !== user.id) throw new Error("Buyer mismatch");

    // A private stage seats the host, an invited email, or a buyer whose session was created after the
    // entry rule was applied (checkout-stage-ticket records that in the session). A session created
    // before that rule existed, by someone the stage never invited, is paid but not seated.
    const { data: stage } = await admin.from("curated_stages")
      .select("id, visibility, invite_token, host_user_id").eq("id", stageId).maybeSingle();
    if (!stage) throw new Error("Stage not found");
    if (!entryWasChecked(session.metadata as Record<string, string> | null)
        && !(await canEnterStage(admin, stage, user))) {
      console.error("[verify-stage-ticket] paid session without an entry check for a private stage", { stageId, userId: user.id, session_id });
      return new Response(JSON.stringify({ error: "INVITE_REQUIRED", paid: true, message: "Payment received, but this stage is invite-only: contact support." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
      });
    }

    // Mark order paid; if the pending row was never recorded, record the paid order from the session.
    const paidAt = new Date().toISOString();
    let { data: order, error: orderErr } = await admin.from("curated_stage_orders")
      .update({ status: "paid", paid_at: paidAt })
      .eq("stripe_session_id", session_id)
      .select("id").maybeSingle();
    if (orderErr) throw new Error("Could not record the payment yet, please try again");
    if (!order) {
      const inserted = await admin.from("curated_stage_orders").insert({
        stage_id: stageId,
        user_id: user.id,
        stripe_session_id: session_id,
        amount_cents: session.amount_total ?? 0,
        currency: (session.currency || "usd").toLowerCase(),
        status: "paid",
        paid_at: paidAt,
      }).select("id").maybeSingle();
      if (inserted.error) throw new Error("Could not record the payment yet, please try again");
      order = inserted.data;
    }

    // Create RSVP, and say so if it could not be written: a paid buyer with no seat must retry, not read "paid".
    const { error: rsvpErr } = await admin.from("curated_stage_rsvps").upsert({
      stage_id: stageId,
      user_id: user.id,
      status: "rsvp",
      ticket_order_id: order?.id ?? null,
    }, { onConflict: "stage_id,user_id" });
    if (rsvpErr) throw new Error("Payment confirmed but your seat could not be saved yet, please try again");

    return new Response(JSON.stringify({ paid: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[verify-stage-ticket]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
