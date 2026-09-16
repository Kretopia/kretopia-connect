import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_FEES: Record<string, number> = {
  'free': 0.15,
  'thriver': 0.15,
  'pro': 0.07,
  'creator_pro': 0.07
};

const getPlatformFee = (tier: string | null): number => {
  return PLATFORM_FEES[tier || 'free'] || 0.15;
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-DIGITAL-PRODUCT] ${step}${detailsStr}`);
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
    
    if (userError || !user?.email) {
      throw new Error("User not authenticated");
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { productId } = await req.json();
    if (!productId) throw new Error("Product ID is required");

    // Use service role for cross-user queries
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get product details with seller profile
    const { data: product, error: productError } = await supabaseAdmin
      .from('digital_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      throw new Error("Product not found");
    }

    // Get seller profile separately
    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, subscription_tier, full_name')
      .eq('user_id', product.user_id)
      .single();

    logStep("Product found", { productId, title: product.title, price: product.price, listing_type: product.listing_type });

    if (!sellerProfile?.stripe_account_id) {
      throw new Error("Seller has not set up payment receiving. They need to connect their payment account first.");
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // Get or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Calculate platform fee
    const platformFeePercent = getPlatformFee(sellerProfile.subscription_tier);
    const priceInCents = Math.round(product.price * 100);
    const applicationFee = Math.round(priceInCents * platformFeePercent);

    logStep("Fee calculation", { 
      price: product.price, 
      listingType: product.listing_type,
      platformFeePercent, 
      applicationFee: applicationFee / 100,
    });

    const origin = req.headers.get("origin") || "https://www.thrivein.io";
    const listingType = product.listing_type || 'digital';

    // For digital products: instant capture
    // For physical/service: authorize only (escrow), capture later
    const captureMethod = listingType === 'digital' ? 'automatic' : 'manual';

    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: product.currency || 'usd',
            product_data: {
              name: product.title,
              description: product.description || `${listingType} listing by ${sellerProfile.full_name}`,
              images: product.preview_urls?.length ? [product.preview_urls[0]] : [],
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: sellerProfile.stripe_account_id,
        },
        capture_method: captureMethod,
        metadata: {
          product_id: productId,
          buyer_id: user.id,
          seller_id: product.user_id,
          listing_type: listingType,
          product_title: product.title,
        },
      },
      success_url: `${origin}/purchase-success?product_id=${productId}&session_id={CHECKOUT_SESSION_ID}&type=${listingType}`,
      cancel_url: `${origin}/market/${productId}?purchase=cancelled`,
      metadata: {
        product_id: productId,
        buyer_id: user.id,
        seller_id: product.user_id,
        listing_type: listingType,
        type: 'marketplace_purchase',
      },
    };

    // Add shipping price for physical items
    if (listingType === 'physical' && product.shipping_price > 0) {
      sessionConfig.line_items.push({
        price_data: {
          currency: product.currency || 'usd',
          product_data: {
            name: 'Shipping',
          },
          unit_amount: Math.round(product.shipping_price * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    logStep("Checkout session created", { sessionId: session.id, captureMethod });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id,
      listingType,
      captureMethod,
      applicationFee: applicationFee / 100,
      sellerReceives: (priceInCents - applicationFee) / 100,
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
