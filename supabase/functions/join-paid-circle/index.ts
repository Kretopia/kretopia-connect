import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_FEES: Record<string, number> = {
  'free': 0.15,
  'thriver': 0.15,
  'pro': 0.07,
  'creator_pro': 0.07,
};

const getPlatformFee = (tier: string | null): number => {
  return PLATFORM_FEES[tier || 'free'] || 0.15;
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[JOIN-PAID-CIRCLE] ${step}${detailsStr}`);
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

    const { circleId } = await req.json();
    if (!circleId) throw new Error("Circle ID is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get circle details
    const { data: circle, error: circleError } = await supabaseAdmin
      .from('spark_rooms')
      .select('*')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      throw new Error("Circle not found");
    }

    logStep("Circle found", { circleId, title: circle.title, price: circle.price_monthly });

    if (!circle.is_paid || !circle.price_monthly || circle.price_monthly <= 0) {
      throw new Error("This is not a paid circle");
    }

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('spark_room_members')
      .select('id')
      .eq('room_id', circleId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      throw new Error("You are already a member of this circle");
    }

    // Check for existing active subscription
    const { data: existingSub } = await supabaseAdmin
      .from('circle_subscriptions')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSub) {
      throw new Error("You already have an active subscription to this circle");
    }

    // Get circle owner's Stripe Connect account
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, subscription_tier, full_name')
      .eq('user_id', circle.created_by)
      .single();

    if (!ownerProfile?.stripe_account_id) {
      throw new Error("Circle owner has not set up payment receiving. They need to connect their ThrivePay account first.");
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // stripe_account_id alone only means Connect onboarding was started -- Stripe
    // doesn't grant the `transfers` capability a destination charge requires until
    // the account is fully verified (a rejected/disabled account still keeps its
    // id on file). Verify live so a bad account fails clearly instead of leaking
    // Stripe's raw capability error to the payer mid-checkout.
    const ownerAccount = await stripe.accounts.retrieve(ownerProfile.stripe_account_id);
    if (ownerAccount.capabilities?.transfers !== "active") {
      throw new Error("Circle owner hasn't finished setting up payouts yet — please try again later.");
    }

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Calculate platform fee
    const platformFeePercent = getPlatformFee(ownerProfile.subscription_tier);
    const priceInCents = Math.round(circle.price_monthly * 100);
    const applicationFee = Math.round(priceInCents * platformFeePercent);

    logStep("Fee calculation", {
      price: circle.price_monthly,
      platformFeePercent,
      applicationFee: applicationFee / 100,
    });

    const origin = req.headers.get("origin") || "https://www.thrivein.io";
    const currency = (circle.currency || 'usd').toLowerCase();

    // Create a subscription-style recurring checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Circle: ${circle.title}`,
              description: circle.description || `Monthly membership to ${circle.title}`,
            },
            unit_amount: priceInCents,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        application_fee_percent: platformFeePercent * 100,
        transfer_data: {
          destination: ownerProfile.stripe_account_id,
        },
        metadata: {
          circle_id: circleId,
          buyer_id: user.id,
          owner_id: circle.created_by,
          type: 'circle_subscription',
        },
      },
      success_url: `${origin}/circle?tab=circles&joined=${circleId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/circle?tab=circles`,
      metadata: {
        circle_id: circleId,
        buyer_id: user.id,
        owner_id: circle.created_by,
        type: 'circle_subscription',
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Record pending subscription
    await supabaseAdmin
      .from('circle_subscriptions')
      .insert({
        circle_id: circleId,
        user_id: user.id,
        status: 'pending',
        amount: circle.price_monthly,
        currency: circle.currency || 'USD',
      });

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
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
