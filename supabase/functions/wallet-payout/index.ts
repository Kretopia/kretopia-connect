import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { cleanPayoutRequest } from "../_shared/payoutRequest.ts";


import { corsFor } from '../_shared/guard.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: auth } = await anon.auth.getUser(token);
    const user = auth?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // A whole number of cents, a three-letter currency, a text idempotency key: see
    // _shared/payoutRequest.ts. Nothing reaches Stripe unchecked.
    const checked = cleanPayoutRequest(await req.json().catch(() => null));
    if (!checked.ok) {
      return new Response(JSON.stringify({ error: checked.error }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { amountCents, currency, method, idempotencyKey } = checked.request;

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
      amount: amountCents,
      currency,
      method,
      ...(defaultMethod?.stripe_external_account_id ? { destination: defaultMethod.stripe_external_account_id } : {}),
      metadata: { thrivein_user_id: user.id },
    }, {
      stripeAccount: wallet.stripe_account_id,
      idempotencyKey: idempotencyKey ?? crypto.randomUUID(),
    });

    const { data: row, error: recordError } = await admin.from("creator_payouts").insert({
      user_id: user.id,
      stripe_payout_id: payout.id,
      amount_cents: payout.amount,
      currency: payout.currency.toUpperCase(),
      status: payout.status,
      arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
      payout_method_id: defaultMethod?.id ?? null,
    }).select().single();

    if (recordError) {
      // The payout exists at Stripe and the row could not be written: say so in the logs and answer
      // with what Stripe returned, so the cash-out is neither lost from view nor repeated.
      console.error("[WALLET-PAYOUT] PAYOUT CREATED BUT NOT RECORDED", { userId: user.id, payoutId: payout.id, message: recordError.message });
    }

    return new Response(JSON.stringify({
      ok: true,
      payout: row ?? {
        user_id: user.id,
        stripe_payout_id: payout.id,
        amount_cents: payout.amount,
        currency: payout.currency.toUpperCase(),
        status: payout.status,
        arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
