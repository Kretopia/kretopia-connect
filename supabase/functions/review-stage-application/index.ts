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

    const { application_id, decision } = await req.json().catch(() => ({}));
    if (!application_id || !["accepted", "declined", "waitlist"].includes(decision)) {
      throw new Error("application_id and valid decision required");
    }

    const { data: app } = await admin
      .from("curated_stage_applications")
      .select("id, stage_id, user_id, curated_stages!inner(host_user_id, title)")
      .eq("id", application_id)
      .single();
    if (!app) throw new Error("Application not found");
    // @ts-ignore — join
    if (app.curated_stages.host_user_id !== user.id) throw new Error("Not stage host");

    const { error } = await admin
      .from("curated_stage_applications")
      .update({ status: decision, reviewed_at: new Date().toISOString() })
      .eq("id", application_id);
    if (error) throw error;

    try {
      await admin.from("notifications").insert({
        user_id: app.user_id,
        type: "stage_application_reviewed",
        title: decision === "accepted" ? "You're in! 🎬" : decision === "waitlist" ? "You're on the waitlist" : "Application update",
        // @ts-ignore
        message: `Your application for "${app.curated_stages.title}" was ${decision}.`,
        action_url: `/circle/stage/${app.stage_id}`,
      });
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[review-stage-application]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
