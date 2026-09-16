import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const {
      type, title, blurb, description, cover_url, starts_at, ends_at, capacity,
      is_paid, price_cents, currency, vibe_tags,
      application_required, application_prompt, turn_seconds, recording_enabled,
      mode, visibility,
    } = body || {};

    if (!["showcase", "scout"].includes(type)) throw new Error("Invalid stage type");
    if (!title || typeof title !== "string") throw new Error("Title required");
    if (!starts_at) throw new Error("Start time required");
    if (new Date(starts_at) < new Date(Date.now() - 5 * 60_000)) throw new Error("Start time must be in the future");

    const safeMode = mode === "audio" ? "audio" : "video";
    const safeVisibility = ["public", "unlisted", "private"].includes(visibility) ? visibility : "public";
    // Private/unlisted stages get a shareable token so the host can share a magic link.
    const inviteToken = safeVisibility === "public"
      ? null
      : Array.from(crypto.getRandomValues(new Uint8Array(18)))
          .map((b) => b.toString(16).padStart(2, "0")).join("");

    const { data: stage, error } = await supabase
      .from("curated_stages")
      .insert({
        host_user_id: user.id,
        type,
        title: title.slice(0, 120),
        blurb: blurb ? String(blurb).slice(0, 600) : null,
        description: description ? String(description).slice(0, 2000) : null,
        cover_url: cover_url || null,
        starts_at,
        ends_at: ends_at || null,
        capacity: Math.min(Math.max(Number(capacity) || 50, 1), 1000),
        is_paid: !!is_paid,
        price_cents: is_paid ? Math.max(0, Number(price_cents) || 0) : 0,
        currency: (currency || "USD").toUpperCase().slice(0, 3),
        vibe_tags: Array.isArray(vibe_tags) ? vibe_tags.slice(0, 6) : [],
        application_required: type === "scout" ? !!application_required : false,
        application_prompt: application_prompt ? String(application_prompt).slice(0, 300) : null,
        turn_seconds: Math.min(Math.max(Number(turn_seconds) || 120, 30), 600),
        recording_enabled: type === "scout" ? true : !!recording_enabled,
        mode: safeMode,
        visibility: safeVisibility,
        invite_token: inviteToken,
        status: "scheduled",
      })
      .select("*")
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ stage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[create-curated-stage]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
