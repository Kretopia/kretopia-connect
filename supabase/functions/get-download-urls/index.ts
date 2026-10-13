import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import {
  ENTITLED_ORDER_STATUSES,
  decideLegacyPurchase,
  orderGrantsFiles,
} from "../_shared/purchaseEntitlement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { orderId, productId } = await req.json();
    if (!orderId && !productId) {
      return new Response(JSON.stringify({ error: "orderId or productId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify ownership: user must be the buyer
    let filePaths: string[] = [];

    if (orderId) {
      const { data: order, error: orderErr } = await adminClient
        .from("marketplace_orders")
        .select("buyer_id, listing_id, listing_type, status")
        .eq("id", orderId)
        .single();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (order.buyer_id !== userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Being the buyer is not enough: a pending, refunded or disputed order
      // does not entitle the buyer to the files.
      if (!orderGrantsFiles(order.status)) {
        return new Response(JSON.stringify({ error: "This order does not give access to the files" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get file paths from product
      const { data: product } = await adminClient
        .from("digital_products")
        .select("file_urls")
        .eq("id", order.listing_id)
        .single();

      filePaths = product?.file_urls || [];
    } else if (productId) {
      const deny = (status: number, error: string) =>
        new Response(JSON.stringify({ error }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      // 1. An order the system wrote (orders have no client INSERT policy)
      //    in a state that entitles the buyer.
      const { data: order, error: orderLookupErr } = await adminClient
        .from("marketplace_orders")
        .select("id")
        .eq("listing_id", productId)
        .eq("buyer_id", userId)
        .in("status", [...ENTITLED_ORDER_STATUSES])
        .limit(1)
        .maybeSingle();
      if (orderLookupErr) return deny(503, "Could not verify this purchase");

      let entitled = !!order;

      // 2. A legacy purchase row. The buyer can write that table themselves
      //    ("Users can create purchases"), so the row alone proves nothing:
      //    the payment provider has to confirm it, for this product and buyer.
      if (!entitled) {
        const { data: rows, error: purchaseErr } = await adminClient
          .from("digital_product_purchases")
          .select("payment_status, payment_intent_id")
          .eq("product_id", productId)
          .eq("buyer_id", userId)
          .limit(5);
        if (purchaseErr) return deny(503, "Could not verify this purchase");

        let refusal: { status: number; error: string } = { status: 403, error: "No purchase found" };
        for (const row of rows ?? []) {
          let intentStatus: unknown = null;
          let intentMetadata: Record<string, unknown> | null = null;
          let refunded = false;
          let lookupFailed = false;
          if (row.payment_status === "completed" && typeof row.payment_intent_id === "string" && row.payment_intent_id) {
            try {
              const stripe = new Stripe(resolveStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
              const intent = await stripe.paymentIntents.retrieve(row.payment_intent_id, { expand: ["latest_charge"] });
              intentStatus = intent.status;
              intentMetadata = intent.metadata as Record<string, unknown>;
              refunded = (intent.latest_charge as Stripe.Charge | null)?.refunded === true;
            } catch (e) {
              // An id the provider has never seen is a refusal; anything else
              // (network, auth, rate limit) is "could not verify".
              if ((e as { code?: string })?.code !== "resource_missing") lookupFailed = true;
            }
          }
          const decision = decideLegacyPurchase({
            paymentStatus: row.payment_status,
            paymentIntentId: row.payment_intent_id,
            intentStatus,
            intentMetadata,
            refunded,
            productId,
            userId,
            lookupFailed,
          });
          if (decision.ok) {
            entitled = true;
            break;
          }
          if (decision.status === 503) refusal = decision;
        }
        if (!entitled) return deny(refusal.status, refusal.error);
      }

      const { data: product } = await adminClient
        .from("digital_products")
        .select("file_urls")
        .eq("id", productId)
        .single();

      filePaths = product?.file_urls || [];
    }

    // Generate fresh signed URLs (1 hour expiry)
    const signedUrls: string[] = [];
    for (const path of filePaths) {
      // Skip if it's already a full URL (legacy data)
      if (path.startsWith("http")) {
        signedUrls.push(path);
        continue;
      }

      const { data } = await adminClient.storage
        .from("product-files")
        .createSignedUrl(path, 60 * 60); // 1 hour

      if (data?.signedUrl) {
        signedUrls.push(data.signedUrl);
      }
    }

    return new Response(JSON.stringify({ downloadUrls: signedUrls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
