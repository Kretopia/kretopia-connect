import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RELEASE-ESCROW] ${step}${detailsStr}`);
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

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    const { orderId, action, reason } = await req.json();
    if (!orderId || !action) throw new Error("orderId and action required");

    logStep("Request", { orderId, action, userId: user.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("marketplace_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("Order not found");

    // Verify the user is the buyer
    if (order.buyer_id !== user.id) {
      throw new Error("Only the buyer can perform this action");
    }

    if (order.status !== "escrow") {
      throw new Error("Order is not in escrow");
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    if (action === "confirm") {
      // Capture the held payment
      if (order.payment_intent_id) {
        try {
          await stripe.paymentIntents.capture(order.payment_intent_id);
          logStep("Payment captured", { paymentIntentId: order.payment_intent_id });
        } catch (stripeErr: any) {
          // If already captured, that's fine
          if (!stripeErr.message?.includes("already been captured")) {
            throw stripeErr;
          }
          logStep("Payment already captured");
        }
      }

      // Update order
      await supabaseAdmin
        .from("marketplace_orders")
        .update({
          status: "completed",
          buyer_confirmed_at: new Date().toISOString(),
          escrow_released_at: new Date().toISOString(),
          delivery_status: "delivered",
          delivered_at: order.delivered_at || new Date().toISOString(),
        })
        .eq("id", orderId);

      // Update transaction
      await supabaseAdmin
        .from("transactions")
        .update({ status: "completed" })
        .eq("user_id", order.seller_id)
        .eq("description", `Escrow: ${order.listing_type}`)
        .eq("status", "pending");

      // Notify seller
      await supabaseAdmin.from("notifications").insert({
        user_id: order.seller_id,
        title: "Payment Released! 💰",
        message: `Buyer confirmed delivery — $${order.amount.toFixed(2)} has been released to you`,
        type: "sale",
        category: "sale",
        priority: "high",
        link: "/purchases",
      });

      logStep("Escrow released successfully");

      return new Response(JSON.stringify({ success: true, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "dispute") {
      if (!reason) throw new Error("Dispute reason is required");

      // Update order to disputed
      await supabaseAdmin
        .from("marketplace_orders")
        .update({
          status: "disputed",
          dispute_reason: reason,
        })
        .eq("id", orderId);

      // Notify seller
      await supabaseAdmin.from("notifications").insert({
        user_id: order.seller_id,
        title: "Order Disputed ⚠️",
        message: `A buyer has disputed an order. Reason: ${reason.substring(0, 100)}`,
        type: "alert",
        category: "general",
        priority: "high",
        link: "/purchases",
      });

      logStep("Dispute filed");

      return new Response(JSON.stringify({ success: true, status: "disputed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Use 'confirm' or 'dispute'.");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
