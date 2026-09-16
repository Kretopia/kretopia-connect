import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID = ["co_sign", "credit", "rolodex", "followup"] as const;
type Outcome = typeof VALID[number];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { stage_id, applicant_user_id, outcome, host_note } = await req.json().catch(() => ({}));
    if (!stage_id || !applicant_user_id || !outcome) {
      throw new Error("stage_id, applicant_user_id, outcome required");
    }
    if (!VALID.includes(outcome as Outcome)) throw new Error("Invalid outcome");

    // Verify host
    const { data: stage } = await admin.from("curated_stages")
      .select("host_user_id, title, starts_at, type")
      .eq("id", stage_id).single();
    if (!stage) throw new Error("Stage not found");
    if (stage.host_user_id !== user.id) throw new Error("Only host can record outcomes");

    const note = host_note ? String(host_note).slice(0, 500) : null;

    // Upsert: reuse latest open turn for this applicant, else insert a synthetic one (ended now)
    const { data: existing } = await admin.from("curated_stage_turns")
      .select("id")
      .eq("stage_id", stage_id)
      .eq("applicant_user_id", applicant_user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let turnId = existing?.id;
    if (turnId) {
      await admin.from("curated_stage_turns").update({
        ended_at: new Date().toISOString(),
        outcome,
        host_note: note,
      }).eq("id", turnId);
    } else {
      const { data: inserted, error: insErr } = await admin.from("curated_stage_turns").insert({
        stage_id,
        applicant_user_id,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        outcome,
        host_note: note,
      }).select("id").single();
      if (insErr) throw insErr;
      turnId = inserted.id;
    }

    // Pre-stamped connection request (context=stage)
    try {
      await admin.from("connections").insert({
        requester_id: user.id,
        recipient_id: applicant_user_id,
        status: "pending",
        context: "stage",
      });
    } catch (_) { /* non-fatal */ }

    // Immediate "Featured" credit for the applicant on "credit" outcome (host can verify)
    if (outcome === "credit") {
      const year = new Date(stage.starts_at).getFullYear();
      try {
        await admin.from("credits").insert({
          user_id: applicant_user_id,
          project_name: stage.title,
          role: stage.type === "scout" ? "Scouted Performer" : "Featured Guest",
          year,
          credit_category: "stage",
          verification_status: "verified",
          verified_by_user_id: user.id,
        });
      } catch (_) { /* non-fatal */ }
    }

    const titles: Record<Outcome, string> = {
      co_sign: "You got a co-sign!",
      credit: "Stamp added by host",
      rolodex: "Saved to host's Rolodex",
      followup: "Host wants to follow up",
    };
    try {
      await admin.from("notifications").insert({
        user_id: applicant_user_id,
        type: "stage_outcome",
        title: titles[outcome as Outcome],
        message: note ?? "Tap to see what's next.",
        action_url: `/circle/stage/${stage_id}`,
      });
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ ok: true, turn_id: turnId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[record-stage-outcome]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
