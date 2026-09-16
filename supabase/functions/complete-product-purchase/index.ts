import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[COMPLETE-PRODUCT-PURCHASE] ${step}${detailsStr}`);
};

serve(async (req) => {
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
    const sellerId = session.metadata?.seller_id || product.user_id;
    const buyerEmail = session.customer_details?.email || session.customer_email;

    // Verify the authenticated user owns this purchase
    if (buyerId && buyerId !== authenticatedUserId) {
      logStep("Ownership mismatch", { buyerId, authenticatedUserId });
      return new Response(JSON.stringify({ error: 'Unauthorized: session does not belong to you' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Buyer info", { buyerId, buyerEmail, listingType });

    // Check if order already exists
    const { data: existingOrder } = await supabaseClient
      .from('marketplace_orders')
      .select('id, download_urls')
      .eq('checkout_session_id', sessionId)
      .maybeSingle();

    if (existingOrder) {
      logStep("Order already recorded", { orderId: existingOrder.id });
      return new Response(JSON.stringify({ 
        success: true,
        orderId: existingOrder.id,
        downloadUrls: existingOrder.download_urls,
        listingType,
        message: 'Purchase already completed'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate auto-release date based on listing type
    const autoReleaseDate = new Date();
    if (listingType === 'digital') {
      autoReleaseDate.setDate(autoReleaseDate.getDate() + 3);
    } else if (listingType === 'physical') {
      autoReleaseDate.setDate(autoReleaseDate.getDate() + 14);
    } else {
      autoReleaseDate.setDate(autoReleaseDate.getDate() + 7);
    }

    // Determine delivery status
    const deliveryStatus = listingType === 'digital' ? 'delivered' : 'pending';
    const orderStatus = listingType === 'digital' ? 'completed' : 'escrow';

    // Store raw file paths (NOT signed URLs) — signed URLs are generated on demand
    const filePaths: string[] = product.file_urls || [];

    // Generate temporary signed URLs for immediate download on success page
    let downloadUrls: string[] = [];
    if (listingType === 'digital' && filePaths.length > 0) {
      for (const filePath of filePaths) {
        if (filePath.startsWith('http')) {
          downloadUrls.push(filePath);
          continue;
        }
        const { data: signedData } = await supabaseClient
          .storage
          .from('product-files')
          .createSignedUrl(filePath, 60 * 60); // 1 hour expiry
        
        if (signedData?.signedUrl) {
          downloadUrls.push(signedData.signedUrl);
        }
      }
    }

    // Create marketplace order
    const { data: order, error: orderError } = await supabaseClient
      .from('marketplace_orders')
      .insert({
        listing_id: productId,
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_type: listingType,
        amount: product.price,
        currency: product.currency || 'usd',
        status: orderStatus,
        payment_intent_id: session.payment_intent as string,
        checkout_session_id: sessionId,
        delivery_status: deliveryStatus,
        delivered_at: listingType === 'digital' ? new Date().toISOString() : null,
        auto_release_at: autoReleaseDate.toISOString(),
        download_urls: filePaths.length > 0 ? filePaths : null,
      })
      .select()
      .single();

    if (orderError) {
      logStep("Error creating order", { error: orderError });
      throw new Error("Failed to record purchase");
    }

    logStep("Order created", { orderId: order.id, status: orderStatus });

    // Also record in legacy purchases table for backward compat
    await supabaseClient
      .from('digital_product_purchases')
      .insert({
        product_id: productId,
        buyer_id: buyerId,
        seller_id: sellerId,
        amount: product.price,
        currency: product.currency || 'usd',
        payment_status: 'completed',
        payment_intent_id: session.payment_intent as string,
        download_urls: filePaths.length > 0 ? filePaths : null,
      });

    // Update download count for digital
    if (listingType === 'digital') {
      await supabaseClient
        .from('digital_products')
        .update({ download_count: (product.download_count || 0) + 1 })
        .eq('id', productId);
    }

    // Record transaction
    await supabaseClient
      .from('transactions')
      .insert({
        user_id: sellerId,
        amount: product.price,
        type: listingType === 'digital' ? 'payment_received' : 'escrow_received',
        description: `${listingType === 'digital' ? 'Sale' : 'Escrow'}: ${product.title}`,
        status: listingType === 'digital' ? 'completed' : 'pending',
      });

    // Notify seller
    const statusMessage = listingType === 'digital' 
      ? `Someone purchased "${product.title}" for $${product.price}` 
      : `New order for "${product.title}" ($${product.price}) — payment held in escrow`;

    await supabaseClient
      .from('notifications')
      .insert({
        user_id: sellerId,
        title: listingType === 'digital' ? 'New Sale! 💰' : 'New Order! 📦',
        message: statusMessage,
        type: 'sale',
        category: 'sale',
        priority: 'high',
        link: '/orders',
      });

    // Send purchase confirmation email to buyer
    if (buyerEmail) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          
          const downloadLinksHtml = listingType === 'digital' && downloadUrls.length > 0
            ? downloadUrls.map((url, i) => 
                `<a href="${url}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:4px 0;">Download File ${downloadUrls.length > 1 ? i + 1 : ''}</a>`
              ).join('<br/>')
            : '';

          const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <div style="text-align:center;margin-bottom:24px;">
                <h1 style="color:#7c3aed;margin:0;">Purchase Confirmed! 🎉</h1>
              </div>
              
              <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:20px;">
                <h2 style="margin:0 0 8px 0;font-size:18px;">${product.title}</h2>
                <p style="margin:0;color:#6b7280;font-size:14px;">
                  ${listingType.charAt(0).toUpperCase() + listingType.slice(1)} • $${product.price} ${(product.currency || 'usd').toUpperCase()}
                </p>
              </div>

              ${listingType === 'digital' ? `
                <div style="margin-bottom:20px;">
                  <h3 style="margin:0 0 12px 0;">Your Downloads</h3>
                  ${downloadLinksHtml || '<p style="color:#6b7280;">Your files are available in your <a href="https://www.kretopia.com/purchases">Purchases</a> dashboard.</p>'}
                  <p style="color:#9ca3af;font-size:12px;margin-top:12px;">Download links expire in 7 days. You can always access them from your purchases.</p>
                </div>
              ` : `
                <div style="margin-bottom:20px;">
                  <h3 style="margin:0 0 8px 0;">What's Next</h3>
                  <p style="color:#6b7280;font-size:14px;">
                    ${listingType === 'physical' 
                      ? 'The seller has been notified and will arrange delivery. Your payment is held securely until you confirm receipt.'
                      : 'The seller has been notified about your booking. Your payment is held securely until the service is completed.'}
                  </p>
                </div>
              `}

              <div style="text-align:center;margin-top:24px;">
                <a href="https://www.kretopia.com/purchases" style="display:inline-block;background:#7c3aed;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">View Your Purchases</a>
              </div>

              <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">
                Order ID: ${order.id}<br/>
                If you have any issues, contact us at info@kretopia.com
              </p>
            </div>
          `;

          await resend.emails.send({
            from: 'Kretopia <info@kretopia.com>',
            to: buyerEmail,
            subject: `Purchase Confirmed: ${product.title}`,
            html: emailHtml,
          });

          logStep("Confirmation email sent", { to: buyerEmail });
        }
      } catch (emailError) {
        logStep("Failed to send email (non-fatal)", { error: String(emailError) });
      }
    }

    logStep("Purchase completed successfully", { orderId: order.id });

    return new Response(JSON.stringify({ 
      success: true,
      orderId: order.id,
      downloadUrls,
      listingType,
      orderStatus,
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
