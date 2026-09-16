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
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { stage_id, cancel } = await req.json().catch(() => ({}));
    if (!stage_id) throw new Error("stage_id required");

    if (cancel) {
      await admin.from("curated_stage_raised_hands").delete()
        .eq("stage_id", stage_id).eq("user_id", user.id);
      return new Response(JSON.stringify({ cancelled: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const { data: stage } = await admin.from("curated_stages")
      .select("status, host_user_id, title").eq("id", stage_id).single();
    if (!stage) throw new Error("Stage not found");
    if (stage.status !== "live") throw new Error("Stage not live");
    if (stage.host_user_id === user.id) throw new Error("Host can't raise hand");

    const { data, error } = await admin.from("curated_stage_raised_hands")
      .upsert({ stage_id, user_id: user.id, status: "pending" }, { onConflict: "stage_id,user_id" })
      .select("*").single();
    if (error) throw error;

    // Best-effort notify host
    try {
      await admin.from("notifications").insert({
        user_id: stage.host_user_id,
        type: "stage_hand_raised",
        title: "🖐 Hand raised on your stage",
        message: "Tap to pull them up.",
        action_url: `/circle/stage/${stage_id}`,
      });
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ hand: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    console.error("[raise-hand-stage]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
