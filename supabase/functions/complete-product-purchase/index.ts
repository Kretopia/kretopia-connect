import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { decideCheckoutSessionBinding } from "../_shared/purchaseEntitlement.ts";
import { deliverableProductFiles } from "../_shared/productFilePaths.ts";


import { corsFor } from '../_shared/guard.ts';
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[COMPLETE-PRODUCT-PURCHASE] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      logStep("Auth failed", { error: claimsError?.message });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authenticatedUserId = claimsData.claims.sub;
    logStep("User authenticated", { userId: authenticatedUserId });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { sessionId, productId } = await req.json();
    if (!sessionId || !productId) {
      throw new Error("Session ID and Product ID are required");
    }

    logStep("Request received", { sessionId, productId });

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      throw new Error("Payment not completed");
    }

    logStep("Payment verified", { paymentStatus: session.payment_status });

    // A paid session is proof of payment for what that session bought, not for
    // any product the caller names. Its metadata is written server-side by
    // purchase-digital-product: it must be a marketplace purchase, for this
    // product, by this user. A missing field is a refusal.
    const binding = decideCheckoutSessionBinding({
      sessionType: session.metadata?.type,
      sessionProductId: session.metadata?.product_id,
      sessionBuyerId: session.metadata?.buyer_id,
      requestedProductId: productId,
      userId: authenticatedUserId,
    });
    if (!binding.ok) {
      logStep("Session binding refused", { sessionId, reason: binding.error });
      return new Response(JSON.stringify({ error: binding.error }), {
        status: binding.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get product details
    const { data: product, error: productError } = await supabaseClient
      .from('digital_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      throw new Error("Product not found");
    }

    const listingType = product.listing_type || 'digital';
    const buyerId = session.metadata?.buyer_id;

    // Read-only: marketplace orders are created exclusively by the signature-verified
    // stripe-marketplace-webhook. This return-page call never writes orders; it only
    // reports the webhook's result and signs fresh download links for the buyer.
    const { data: existingOrder } = await supabaseClient
      .from('marketplace_orders')
      .select('id, status, buyer_id')
      .eq('checkout_session_id', sessionId)
      .maybeSingle();

    if (!existingOrder || existingOrder.buyer_id !== buyerId) {
      return new Response(JSON.stringify({ success: false, pending: true, listingType,
        message: 'Payment received, confirming your order' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 202,
      });
    }

    const filePaths: string[] = deliverableProductFiles(product.file_urls, product.user_id);
    const downloadUrls: string[] = [];
    if (listingType === 'digital') {
      for (const filePath of filePaths) {
        if (filePath.startsWith('http')) { downloadUrls.push(filePath); continue; }
        const { data: signedData } = await supabaseClient.storage
          .from('product-files').createSignedUrl(filePath, 60 * 60);
        if (signedData?.signedUrl) downloadUrls.push(signedData.signedUrl);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      orderId: existingOrder.id,
      downloadUrls,
      listingType,
      orderStatus: existingOrder.status,
      message: 'Purchase completed',
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
