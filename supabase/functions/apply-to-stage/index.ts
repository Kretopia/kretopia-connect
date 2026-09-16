import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CAP_BY_TIER: Record<string, number> = {
  free: 2, spark: 2, thriver: 2,
  pro: 10, creator: 10, creator_pro: -1,
  founding_member: -1, og: -1,
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

    const { stage_id, pitch, voice_url } = await req.json().catch(() => ({}));
    if (!stage_id) throw new Error("stage_id required");

    const { data: stage } = await admin.from("curated_stages").select("type, status, host_user_id, vibe_tags").eq("id", stage_id).single();
    if (!stage) throw new Error("Stage not found");
    if (stage.type !== "scout") throw new Error("Applications only on Scout Stages");
    if (!["scheduled", "live"].includes(stage.status)) throw new Error("Stage not accepting applications");
    if (stage.host_user_id === user.id) throw new Error("Hosts can't apply to their own stage");

    const { data: prof } = await admin.from("profiles").select("subscription_tier").eq("user_id", user.id).maybeSingle();
    const tier = prof?.subscription_tier || "free";
    const cap = CAP_BY_TIER[tier] ?? 2;

    const { data: gate } = await admin.rpc("consume_stage_application", { _user_id: user.id, _monthly_cap: cap });
    const row = Array.isArray(gate) ? gate[0] : gate;
    if (row && !row.allowed) {
      return new Response(JSON.stringify({ error: "STAGE_APPLY_LIMIT", used: row.used, cap: row.cap }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Smart Match: lightweight role/vibe overlap score (0..1)
    const [{ data: hostProf }, { data: meProf }] = await Promise.all([
      admin.from("profiles").select("primary_role, professional_skills, passion_skills").eq("user_id", stage.host_user_id).maybeSingle(),
      admin.from("profiles").select("primary_role, professional_skills, passion_skills").eq("user_id", user.id).maybeSingle(),
    ]);
    const mySkills: string[] = [
      ...((meProf as any)?.professional_skills || []),
      ...((meProf as any)?.passion_skills || []),
    ];
    let score = 0.30;
    if (hostProf?.primary_role && meProf?.primary_role &&
        String(hostProf.primary_role).toLowerCase() === String(meProf.primary_role).toLowerCase()) {
      score += 0.30;
    }
    const tags = ((stage as any).vibe_tags || []).map((t: string) => t.toLowerCase());
    const skills = mySkills.map((s: string) => String(s).toLowerCase());
    const hits = tags.filter((t: string) => skills.includes(t) || skills.some((s: string) => s.includes(t) || t.includes(s)));
    score += Math.min(0.40, hits.length * 0.15);
    if (pitch && String(pitch).trim().length > 80) score += 0.05;
    score = Math.min(1, Math.round(score * 100) / 100);

    const { data: app, error } = await admin
      .from("curated_stage_applications")
      .upsert({
        stage_id,
        user_id: user.id,
        pitch: pitch ? String(pitch).slice(0, 1000) : null,
        voice_url: voice_url || null,
        status: "pending",
        match_score: score,
      }, { onConflict: "stage_id,user_id" })
      .select("*")
      .single();
    if (error) throw error;

    // Notify host
    try {
      await admin.from("notifications").insert({
        user_id: stage.host_user_id,
        type: "stage_application",
        title: "New application to your Scout Stage",
        message: pitch ? String(pitch).slice(0, 140) : "Tap to review.",
        action_url: `/circle/stage/${stage_id}`,
      });
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ application: app }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[apply-to-stage]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
