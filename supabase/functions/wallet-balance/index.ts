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

    const { data: wallet } = await admin
      .from("creator_wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: methods } = await admin
      .from("creator_payout_methods")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });

    let balances: Array<{ currency: string; available_cents: number; pending_cents: number }> = [];

    if (wallet?.stripe_account_id) {
      try {
        const stripe = new Stripe(resolveStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
        const bal = await stripe.balance.retrieve({ stripeAccount: wallet.stripe_account_id });
        const map = new Map<string, { available_cents: number; pending_cents: number }>();
        for (const b of bal.available ?? []) {
          const k = b.currency.toUpperCase();
          map.set(k, { available_cents: b.amount, pending_cents: map.get(k)?.pending_cents ?? 0 });
        }
        for (const b of bal.pending ?? []) {
          const k = b.currency.toUpperCase();
          const cur = map.get(k) ?? { available_cents: 0, pending_cents: 0 };
          map.set(k, { ...cur, pending_cents: b.amount });
        }
        balances = [...map.entries()].map(([currency, v]) => ({ currency, ...v }));

        // mirror
        for (const row of balances) {
          await admin.from("creator_wallet_balances").upsert({
            user_id: user.id,
            currency: row.currency,
            available_cents: row.available_cents,
            pending_cents: row.pending_cents,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,currency" });
        }
      } catch (e) {
        console.log("[wallet-balance] stripe error", e instanceof Error ? e.message : e);
      }
    }

    if (balances.length === 0) {
      const { data: mirror } = await admin
        .from("creator_wallet_balances")
        .select("currency, available_cents, pending_cents")
        .eq("user_id", user.id);
      balances = mirror ?? [];
    }

    return new Response(JSON.stringify({
      wallet: wallet ?? null,
      methods: methods ?? [],
      balances,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
