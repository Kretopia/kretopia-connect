import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.23.8";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-guest-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  amount: z.number().min(1).max(1000), // dollars
  currency: z.enum(["USD"]).default("USD"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = req.headers.get("x-guest-token") ?? "";
    if (!UUID_RE.test(token)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid amount (must be $1–$1000)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { amount, currency } = parsed.data;
    const amountCents = Math.round(amount * 100);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session } = await admin
      .from("guest_wallet_sessions")
      .select("wallet_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!session || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: wallet } = await admin
      .from("guest_wallets")
      .select("id, email")
      .eq("id", session.wallet_id)
      .single();
    if (!wallet) throw new Error("Wallet not found");

    // Create pending topup row
    const { data: topup, error: topupError } = await admin
      .from("guest_wallet_topups")
      .insert({
        wallet_id: wallet.id,
        amount_cents: amountCents,
        currency,
        status: "pending",
      })
      .select("id")
      .single();
    if (topupError) throw topupError;

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://www.thrivein.io";

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      // Apple Pay & Google Pay are auto-enabled within the "card" method on Checkout.
      payment_method_types: ["card"],
      customer_email: wallet.email,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: "Guest Wallet Top-Up",
              description: `Add ${currency} ${amount.toFixed(2)} to your guest wallet`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/guest-pay?topup=success&id=${topup.id}`,
      cancel_url: `${origin}/guest-pay?topup=cancelled&id=${topup.id}`,
      metadata: {
        topup_id: topup.id,
        wallet_id: wallet.id,
        kind: "guest_wallet_topup",
      },
    });

    await admin
      .from("guest_wallet_topups")
      .update({ stripe_session_id: checkout.id })
      .eq("id", topup.id);

    return new Response(
      JSON.stringify({ url: checkout.url, topupId: topup.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[guest-wallet-topup] error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
