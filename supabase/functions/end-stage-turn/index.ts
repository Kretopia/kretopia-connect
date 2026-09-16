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

    const { turn_id, outcome, host_note } = await req.json().catch(() => ({}));
    if (!turn_id) throw new Error("turn_id required");
    const validOutcomes = ["co_sign", "credit", "rolodex", "followup", "pass", "timeout"];
    if (outcome && !validOutcomes.includes(outcome)) throw new Error("Invalid outcome");

    const { data: turn } = await admin.from("curated_stage_turns")
      .select("id, stage_id, applicant_user_id, curated_stages!inner(host_user_id)")
      .eq("id", turn_id).single();
    if (!turn) throw new Error("Turn not found");
    // @ts-ignore
    if (turn.curated_stages.host_user_id !== user.id) throw new Error("Only host can end turns");

    const { error } = await admin.from("curated_stage_turns")
      .update({
        ended_at: new Date().toISOString(),
        outcome: outcome || "pass",
        host_note: host_note ? String(host_note).slice(0, 500) : null,
      })
      .eq("id", turn_id);
    if (error) throw error;

    // Auto-create a connection request when outcome is positive
    if (outcome && ["co_sign", "rolodex", "followup", "credit"].includes(outcome)) {
      try {
        await admin.from("connections").insert({
          requester_id: user.id,
          recipient_id: turn.applicant_user_id,
          status: "pending",
          context: "stage",
        });
      } catch (_e) { /* best-effort */ }

      try {
        await admin.from("notifications").insert({
          user_id: turn.applicant_user_id,
          type: "stage_outcome",
          title: outcome === "co_sign" ? "You got a co-sign!" : outcome === "credit" ? "Stamp added by host" : "Host wants to follow up",
          message: host_note ? String(host_note).slice(0, 140) : "Tap to see what's next.",
          action_url: `/circle/stage/${turn.stage_id}`,
        });
      } catch (_e) { /* best-effort */ }
    }


    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[end-stage-turn]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
