// Public read of a payment link by slug. Used by the /pay/:slug page.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) throw new Error("slug required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: link } = await admin
      .from("payment_links")
      .select("id, user_id, slug, title, description, mode, amount_cents, min_amount_cents, max_amount_cents, currency, single_use, max_uses, use_count, active, cover_image_url")
      .eq("slug", slug)
      .maybeSingle();

    if (!link || !link.active) {
      return new Response(JSON.stringify({ error: "Link not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.single_use && link.use_count >= 1) {
      return new Response(JSON.stringify({ error: "This link has already been used" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.max_uses && link.use_count >= link.max_uses) {
      return new Response(JSON.stringify({ error: "This link has reached its usage limit" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recipient info (public-safe)
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("user_id", link.user_id)
      .maybeSingle();

    return new Response(JSON.stringify({ link, recipient: profile ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
