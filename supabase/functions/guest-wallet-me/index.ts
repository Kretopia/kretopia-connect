import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-guest-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    // Touch last_used_at (fire and forget)
    admin
      .from("guest_wallet_sessions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("token", token)
      .then(() => {});

    const [{ data: wallet }, { data: topups }] = await Promise.all([
      admin
        .from("guest_wallets")
        .select("id, email, balance_cents, currency")
        .eq("id", session.wallet_id)
        .single(),
      admin
        .from("guest_wallet_topups")
        .select("id, amount_cents, currency, status, created_at")
        .eq("wallet_id", session.wallet_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return new Response(
      JSON.stringify({ wallet, topups: topups ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[guest-wallet-me] error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
