import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { eventId, tierId, code, quantity = 1 } = await req.json();
    if (!eventId || !code) throw new Error("eventId and code required");

    const { data: tier } = await admin
      .from("event_ticket_tiers")
      .select("price")
      .eq("id", tierId)
      .single();
    const unitPrice = tier ? Number(tier.price) : 0;
    const subtotal = unitPrice * quantity;

    const { data: promo } = await admin
      .from("event_promo_codes")
      .select("*")
      .eq("event_id", eventId)
      .eq("code", String(code).trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (!promo) {
      return new Response(JSON.stringify({ valid: false, reason: "Invalid code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now)
      return new Response(JSON.stringify({ valid: false, reason: "Not yet active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (promo.valid_until && new Date(promo.valid_until) < now)
      return new Response(JSON.stringify({ valid: false, reason: "Expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (promo.max_uses != null && promo.uses_count >= promo.max_uses)
      return new Response(JSON.stringify({ valid: false, reason: "Fully redeemed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (promo.applies_to_tier_ids?.length && tierId && !promo.applies_to_tier_ids.includes(tierId))
      return new Response(JSON.stringify({ valid: false, reason: "Not valid for this tier" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const discount =
      promo.discount_type === "percent"
        ? Math.round(subtotal * (Number(promo.discount_value) / 100) * 100) / 100
        : Math.min(subtotal, Number(promo.discount_value));

    return new Response(
      JSON.stringify({
        valid: true,
        discount,
        subtotal,
        total: Math.max(0, subtotal - discount),
        type: promo.discount_type,
        value: Number(promo.discount_value),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ valid: false, reason: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
