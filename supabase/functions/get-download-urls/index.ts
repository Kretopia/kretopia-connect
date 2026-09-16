import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

      // Get file paths from product
      const { data: product } = await adminClient
        .from("digital_products")
        .select("file_urls")
        .eq("id", order.listing_id)
        .single();

      filePaths = product?.file_urls || [];
    } else if (productId) {
      // Check purchase exists for this user
      const { data: purchase } = await adminClient
        .from("digital_product_purchases")
        .select("id")
        .eq("product_id", productId)
        .eq("buyer_id", userId)
        .limit(1)
        .maybeSingle();

      if (!purchase) {
        // Also check marketplace_orders
        const { data: order } = await adminClient
          .from("marketplace_orders")
          .select("id")
          .eq("listing_id", productId)
          .eq("buyer_id", userId)
          .limit(1)
          .maybeSingle();

        if (!order) {
          return new Response(JSON.stringify({ error: "No purchase found" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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
