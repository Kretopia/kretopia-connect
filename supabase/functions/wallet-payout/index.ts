import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: auth } = await anon.auth.getUser(token);
    const user = auth?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { amount_cents, currency, method = "standard", idempotencyKey } = await req.json();
    if (!amount_cents || amount_cents <= 0 || !currency) {
      return new Response(JSON.stringify({ error: "Invalid amount or currency" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: wallet } = await admin
      .from("creator_wallets")
      .select("stripe_account_id, payouts_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!wallet?.stripe_account_id || !wallet.payouts_enabled) {
      return new Response(JSON.stringify({ error: "Wallet not ready. Add a bank account first." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: defaultMethod } = await admin
      .from("creator_payout_methods")
      .select("id, stripe_external_account_id")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();

    const stripe = new Stripe(resolveStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    // Idempotency: a double-click or client retry after a slow response
    // must not create two real payouts. Falls back to a server-generated
    // key (still correct per-request, just not retry-safe) if the client
    // didn't supply one — Stripe's own idempotency dedup is keyed on this
    // value for ~24h. See KREPAY_PAYMENT_AUDIT.md finding #5.
    const payout = await stripe.payouts.create({
      amount: Math.round(amount_cents),
      currency: currency.toLowerCase(),
      method: method === "instant" ? "instant" : "standard",
      ...(defaultMethod?.stripe_external_account_id ? { destination: defaultMethod.stripe_external_account_id } : {}),
      metadata: { thrivein_user_id: user.id },
    }, {
      stripeAccount: wallet.stripe_account_id,
      idempotencyKey: typeof idempotencyKey === "string" && idempotencyKey ? idempotencyKey : crypto.randomUUID(),
    });

    const { data: row } = await admin.from("creator_payouts").insert({
      user_id: user.id,
      stripe_payout_id: payout.id,
      amount_cents: payout.amount,
      currency: payout.currency.toUpperCase(),
      status: payout.status,
      arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
      payout_method_id: defaultMethod?.id ?? null,
    }).select().single();

    return new Response(JSON.stringify({ ok: true, payout: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
