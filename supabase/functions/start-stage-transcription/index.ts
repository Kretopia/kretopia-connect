import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAILY_API = "https://api.daily.co/v1";

/**
 * Phase 3C — Server-side Daily transcription control.
 * Client toggles captions; we call Daily REST with the domain API key so
 * the room is granted live transcription on demand (no Deepgram key
 * required on the client, no `Captions unavailable` toast).
 *
 * Body: { room_name: string, action: "start" | "stop", stage_id?: string }
 * Only the host of the stage may toggle.
 */
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const roomName = String(body.room_name ?? "").trim();
    const action = body.action === "stop" ? "stop" : "start";
    const stageId = body.stage_id ? String(body.stage_id) : null;
    if (!roomName) {
      return new Response(JSON.stringify({ error: "room_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Host verification — only host of the matching stage may toggle.
    // Look up by room_name across the three stage tables.
    const tables = ["sound_stages", "speed_sessions", "curated_stages"];
    let hostUserId: string | null = null;
    for (const t of tables) {
      const { data } = await admin
        .from(t)
        .select("host_user_id")
        .eq("room_name", roomName)
        .maybeSingle();
      if (data?.host_user_id) {
        hostUserId = data.host_user_id as string;
        break;
      }
    }
    if (hostUserId && hostUserId !== userId) {
      return new Response(JSON.stringify({ error: "Host only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `${DAILY_API}/rooms/${encodeURIComponent(roomName)}/transcription/${action}`;
    const payload =
      action === "start"
        ? {
            language: "en",
            model: "nova-2-general",
            punctuate: true,
            profanity_filter: false,
            extra: { interim_results: true },
          }
        : {};
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const txt = await res.text();
    if (!res.ok) {
      console.warn("[start-stage-transcription] daily error", res.status, txt);
      return new Response(
        JSON.stringify({
          error: `Daily ${action} failed`,
          status: res.status,
          detail: txt.slice(0, 400),
        }),
        {
          status: res.status === 402 ? 402 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, action, stage_id: stageId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[start-stage-transcription]", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
