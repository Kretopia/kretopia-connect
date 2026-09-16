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

    const { stage_id, cancel, invite_token } = await req.json().catch(() => ({}));
    if (!stage_id) throw new Error("stage_id required");

    if (cancel) {
      await admin.from("curated_stage_rsvps").delete()
        .eq("stage_id", stage_id).eq("user_id", user.id);
      return new Response(JSON.stringify({ cancelled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const { data: stage } = await admin.from("curated_stages")
      .select("id, status, capacity, is_paid, rsvp_count, visibility, invite_token, host_user_id").eq("id", stage_id).single();
    if (!stage) throw new Error("Stage not found");
    if (!["scheduled", "live"].includes(stage.status)) throw new Error("Stage not open for RSVP");

    // Private-stage gate: only host, invite-token holders, or invited emails can RSVP.
    if (stage.visibility === "private" && stage.host_user_id !== user.id) {
      let allowed = invite_token && stage.invite_token && invite_token === stage.invite_token;
      if (!allowed) {
        const email = (user.email || "").toLowerCase();
        if (email) {
          const { data: inv } = await admin.from("curated_stage_invites")
            .select("id").eq("stage_id", stage_id).ilike("email", email).neq("status", "revoked").maybeSingle();
          allowed = !!inv;
        }
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: "INVITE_REQUIRED" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (stage.is_paid) {
      // Paid flow handled separately by checkout-event-tickets equivalent.
      // For Phase 2 free RSVP only — paid path returns a hint.
      return new Response(JSON.stringify({ error: "PAID_STAGE", message: "Use ticket checkout" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rsvpStatus = stage.rsvp_count >= stage.capacity ? "waitlist" : "rsvp";

    const { data, error } = await admin.from("curated_stage_rsvps")
      .upsert({ stage_id, user_id: user.id, status: rsvpStatus }, { onConflict: "stage_id,user_id" })
      .select("*").single();
    if (error) throw error;

    return new Response(JSON.stringify({ rsvp: data, status: rsvpStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[rsvp-curated-stage]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
