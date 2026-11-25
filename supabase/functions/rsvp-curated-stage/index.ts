import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendStageRegistrationEmail, shouldSendRegistrationEmail } from "../_shared/stageRegistrationEmail.ts";
import { canEnterStage } from "../_shared/stageTicket.ts";


import { corsFor } from '../_shared/guard.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
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
      .select("id, title, starts_at, ends_at, status, capacity, is_paid, rsvp_count, visibility, invite_token, host_user_id").eq("id", stage_id).single();
    if (!stage) throw new Error("Stage not found");
    if (!["scheduled", "live"].includes(stage.status)) throw new Error("Stage not open for RSVP");

    // Private-stage gate: only host, invite-token holders, or invited emails can RSVP.
    // The same entry rule the paid path applies (see _shared/stageTicket.ts).
    if (!(await canEnterStage(admin, { ...stage, id: stage_id }, user, invite_token))) {
      return new Response(JSON.stringify({ error: "INVITE_REQUIRED" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (stage.is_paid) {
      // Paid flow handled separately by checkout-event-tickets equivalent.
      // For Phase 2 free RSVP only — paid path returns a hint.
      return new Response(JSON.stringify({ error: "PAID_STAGE", message: "Use ticket checkout" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The person's current registration: a repeat RSVP keeps a spot they already hold (rsvp_count already counts them, so a full
    // Stage used to move them to the waitlist) and sends no second confirmation.
    const { data: previous } = await admin.from("curated_stage_rsvps")
      .select("status").eq("stage_id", stage_id).eq("user_id", user.id).maybeSingle();
    const rsvpStatus = previous?.status === "rsvp" ? "rsvp" : stage.rsvp_count >= stage.capacity ? "waitlist" : "rsvp";

    const { data, error } = await admin.from("curated_stage_rsvps")
      .upsert({ stage_id, user_id: user.id, status: rsvpStatus }, { onConflict: "stage_id,user_id" })
      .select("*").single();
    if (error) throw error;

    // Confirmation email, once per registration state (new spot, new waitlist place, waitlist -> spot). Best effort: the
    // registration above is saved whatever happens to the email.
    if (shouldSendRegistrationEmail(previous?.status, rsvpStatus)) {
      const { data: host } = await admin.from("profiles").select("full_name").eq("user_id", stage.host_user_id).maybeSingle();
      await sendStageRegistrationEmail({
        supabaseUrl: Deno.env.get("SUPABASE_URL")!,
        serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        userId: user.id,
        stage,
        status: rsvpStatus,
        attendeeName: (user.user_metadata?.full_name as string | undefined) ?? null,
        hostName: host?.full_name ?? null,
        inviteToken: typeof invite_token === "string" ? invite_token : null,
      });
    }

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
