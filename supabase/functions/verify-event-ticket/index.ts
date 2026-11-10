import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";


import { corsFor, safeError } from '../_shared/guard.ts';
import { publicPerimeter } from '../_shared/publicPerimeter.ts';
const log = (s: string, d?: any) =>
  console.log(`[verify-event-ticket] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try {
      await publicPerimeter(req, "verify-event-ticket", 10);
    } catch (perimeterError) {
      return safeError(perimeterError, req);
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { sessionId, orderId } = body || {};
    if (!sessionId && !orderId) throw new Error("sessionId or orderId required");

    const { data: order, error: orderErr } = await admin
      .from("event_orders")
      .select("id, status")
      .eq(sessionId ? "stripe_session_id" : "id", sessionId || orderId)
      .single();
    if (orderErr || !order) throw new Error("Order not found");

    // Already finalized
    if (order.status === "paid") {
      return new Response(JSON.stringify({ status: "paid", orderId: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Read-only: tickets are activated exclusively by the signature-verified payment
    // webhook (stripe-marketplace-webhook -> finalizeEventOrder). This return-page
    // call only reports the current order status.
    return new Response(JSON.stringify({ status: "pending" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
