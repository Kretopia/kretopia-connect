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

    const { stage_id } = await req.json().catch(() => ({}));
    if (!stage_id) throw new Error("stage_id required");

    const { data: stage } = await admin.from("curated_stages")
      .select("host_user_id, title, status, starts_at, recording_url, type")
      .eq("id", stage_id).single();
    if (!stage) throw new Error("Stage not found");
    if (stage.host_user_id !== user.id) throw new Error("Only host can end stage");
    if (stage.status === "ended") {
      return new Response(JSON.stringify({ ok: true, already: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    await admin.from("curated_stages").update({
      status: "ended", ends_at: new Date().toISOString(),
    }).eq("id", stage_id);

    // Update attended count
    const { count } = await admin.from("curated_stage_rsvps")
      .select("*", { count: "exact", head: true })
      .eq("stage_id", stage_id).eq("status", "attended");
    if (count != null) {
      await admin.from("curated_stages").update({ attended_count: count }).eq("id", stage_id);
    }

    // Roll-call credits: Host gets a "Stage Host" credit; positive-outcome turn applicants get "Featured" credit
    const year = new Date(stage.starts_at).getFullYear();
    const hostRole = stage.type === "scout" ? "Scout Stage Host" : "Showcase Host";
    try {
      await admin.from("credits").insert({
        user_id: stage.host_user_id,
        project_name: stage.title,
        role: hostRole,
        year,
        credit_category: "stage",
        verification_status: "verified",
      });
    } catch (_e) { /* best-effort */ }


    const { data: turns } = await admin.from("curated_stage_turns")
      .select("applicant_user_id, outcome")
      .eq("stage_id", stage_id)
      .in("outcome", ["co_sign", "credit", "rolodex", "followup"]);
    const featured = Array.from(new Set((turns || []).map((t: any) => t.applicant_user_id)));
    if (featured.length) {
      try {
        await admin.from("credits").insert(featured.map((uid) => ({
          user_id: uid,
          project_name: stage.title,
          role: stage.type === "scout" ? "Scouted Performer" : "Featured Guest",
          year,
          credit_category: "stage",
          verification_status: "verified",
          verified_by_user_id: stage.host_user_id,
        })));
      } catch (_e) { /* best-effort */ }
    }


    // Best-effort recap notification to all attendees
    const { data: attendees } = await admin.from("curated_stage_rsvps")
      .select("user_id").eq("stage_id", stage_id).eq("status", "attended");
    if (attendees?.length) {
      const recordingNote = stage.recording_url ? " Recording is up." : "";
      const notifs = attendees.map((a) => ({
        user_id: a.user_id,
        type: "stage_recap",
        title: `Wrap on "${stage.title}"`,
        message: `Thanks for showing up.${recordingNote} Tap to see follow-ups.`,
        action_url: `/circle/stage/${stage_id}`,
      }));
      try { await admin.from("notifications").insert(notifs); } catch (_e) { /* best-effort */ }
    }


    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[end-curated-stage]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
