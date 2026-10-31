import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { WALLET_CURRENCY, cleanTopupRequest } from "../_shared/walletTopup.ts";


import { corsFor } from '../_shared/guard.ts';
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WALLET-TOPUP] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("User not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user?.email) {
      throw new Error("User not authenticated");
    }

    // The wallet has one balance, in USD: a top-up in another currency credited the same NUMBER
    // (10,000 of a cheap currency became 10,000 of balance). The amount is whole cents, the
    // currency is the wallet's own. See _shared/walletTopup.ts.
    const checked = cleanTopupRequest(await req.json().catch(() => null));
    if (!checked.ok) throw new Error(checked.error);
    const { amount, gateway } = checked;
    const currency = WALLET_CURRENCY;

    // WiPay is a placeholder: answer before a pending top-up row is created for it.
    if (gateway === "wipay") {
      return new Response(JSON.stringify({
        error: "WiPay integration coming soon. Please use card payment for now.",
        gateway: "wipay",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Top-up request", { userId: user.id, amount, currency, gateway });

    // Create topup record
    const { data: topup, error: topupError } = await supabaseAdmin
      .from("wallet_topups")
      .insert({
        user_id: user.id,
        amount,
        currency: currency.toUpperCase(),
        payment_gateway: gateway,
        status: "pending",
      })
      .select()
      .single();

    if (topupError) throw topupError;

    if (gateway === "stripe") {
      const stripe = new Stripe(resolveStripeSecretKey(), {
        apiVersion: "2025-08-27.basil",
      });

      // Get or create customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

      const amountInCents = Math.round(amount * 100);
      const origin = req.headers.get("origin") || "https://www.kretopia.com";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: "Wallet Top-Up",
                description: `Add ${currency.toUpperCase()} ${amount.toFixed(2)} to your Kretopia wallet`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/thrivepay?topup=success&topup_id=${topup.id}`,
        cancel_url: `${origin}/thrivepay?topup=cancelled`,
        metadata: {
          topup_id: topup.id,
          user_id: user.id,
          type: "wallet_topup",
        },
      });

      // Update topup with session ID
      await supabaseAdmin
        .from("wallet_topups")
        .update({ gateway_session_id: session.id })
        .eq("id", topup.id);

      logStep("Stripe session created", { sessionId: session.id });

      return new Response(JSON.stringify({
        url: session.url,
        topupId: topup.id,
        gateway: "stripe",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Unreachable: cleanTopupRequest only lets "stripe" and "wipay" through and "wipay" returned above.
    throw new Error("Unsupported payment gateway");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
