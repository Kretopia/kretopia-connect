import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_API = "https://api.daily.co/v1";

/**
 * Host promotes a raised hand to speaker. Marks hand 'promoted', creates a turn,
 * mints a speaker token (audio/video on) for the promoted user, and notifies them.
 * The applicant's client receives the token via Realtime on curated_stage_raised_hands
 * (status flips to 'promoted', promoted_at set) and re-enters the room with mic on.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

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

    const { hand_id, dismiss } = await req.json().catch(() => ({}));
    if (!hand_id) throw new Error("hand_id required");

    const { data: hand } = await admin
      .from("curated_stage_raised_hands")
      .select("id, stage_id, user_id, status, curated_stages!inner(host_user_id, room_name, title, status)")
      .eq("id", hand_id).single();
    if (!hand) throw new Error("Raised hand not found");
    // @ts-ignore
    if (hand.curated_stages.host_user_id !== user.id) throw new Error("Only host can promote");

    if (dismiss) {
      await admin.from("curated_stage_raised_hands").update({ status: "dismissed" }).eq("id", hand_id);
      return new Response(JSON.stringify({ dismissed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // @ts-ignore
    const roomName = hand.curated_stages.room_name;
    if (!roomName) throw new Error("Stage room not started");

    // Mint a speaker token (audio/video on, owner-ish but not stage owner)
    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_id: hand.user_id,
          is_owner: false,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
        },
      }),
    });
    if (!tokenRes.ok) throw new Error(`Daily token failed: ${tokenRes.status}`);
    const { token } = await tokenRes.json();

    // Mark promoted + store token in promoted_at (we'll relay via notifications since we can't add a column post-migration easily — use realtime broadcast instead)
    await admin.from("curated_stage_raised_hands")
      .update({ status: "promoted", promoted_at: new Date().toISOString() })
      .eq("id", hand_id);

    // Create turn row so end-stage-turn / outcomes work
    const { data: turn } = await admin.from("curated_stage_turns")
      .insert({ stage_id: hand.stage_id, applicant_user_id: hand.user_id })
      .select("id").single();

    // Broadcast token to promoted user via Realtime channel they're listening on
    const channel = admin.channel(`stage_speaker_${hand.stage_id}_${hand.user_id}`);
    await channel.send({
      type: "broadcast",
      event: "promoted",
      payload: { token, turn_id: turn?.id, hand_id },
    });

    try {
      await admin.from("notifications").insert({
        user_id: hand.user_id,
        type: "stage_promoted",
        title: "You're up — host pulled you on stage",
        message: "Tap to come on with mic and camera.",
        action_url: `/circle/stage/${hand.stage_id}`,
      });
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ ok: true, turn_id: turn?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[promote-raised-hand]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
