// Daily.co webhook receiver.
// Daily fires `recording.ready-to-download` once a cloud recording has
// finished processing. We acknowledge fast (under 5s — Daily requirement)
// and hand off transcription to a background invocation of `transcribe-call`.
//
// Configure in Daily dashboard → Webhooks:
//   URL: https://<project>.functions.supabase.co/daily-recording-webhook
//   Events: recording.ready-to-download
//   (Optional) HMAC secret → set DAILY_WEBHOOK_HMAC_SECRET

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

// Constant-time hex comparison
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.text();

    // ===== Signature validation — mandatory =====
    const hmacSecret = Deno.env.get("DAILY_WEBHOOK_HMAC_SECRET");
    if (!hmacSecret) {
      console.error("[daily-recording-webhook] DAILY_WEBHOOK_HMAC_SECRET not set");
      return new Response(
        JSON.stringify({ error: "misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Daily signs with HMAC-SHA256(timestamp + "." + body). It sends
    // `x-webhook-signature` (hex) and `x-webhook-timestamp` (unix seconds).
    // Fall back to a raw-body signature for older webhook configs.
    const incomingSig = (req.headers.get("x-webhook-signature") || "").trim().toLowerCase();
    const timestamp = (req.headers.get("x-webhook-timestamp") || "").trim();
    if (!incomingSig) {
      return new Response("missing signature", { status: 401, headers: corsHeaders });
    }
    const candidates: string[] = [];
    if (timestamp) candidates.push(await hmacSha256Hex(hmacSecret, `${timestamp}.${raw}`));
    candidates.push(await hmacSha256Hex(hmacSecret, raw));
    const ok = candidates.some((c) => timingSafeEqualHex(c, incomingSig));
    if (!ok) {
      console.warn("[daily-recording-webhook] signature mismatch");
      return new Response("bad signature", { status: 401, headers: corsHeaders });
    }

    const payload = JSON.parse(raw);
    const event = payload?.type ?? payload?.event ?? "";

    // Daily echoes a `test` event when you save the webhook in their dashboard.
    if (event === "test" || event === "ping") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only act on completed recordings.
    if (event !== "recording.ready-to-download" && event !== "recording.finished") {
      console.log("[daily-recording-webhook] ignoring event:", event);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload?.payload ?? payload?.data ?? payload;
    const roomName: string | undefined = data?.room_name ?? data?.room;
    const recordingId: string | undefined = data?.recording_id ?? data?.id;
    const downloadUrl: string | undefined = data?.download_link ?? data?.download_url;
    const duration: number | undefined = data?.duration;

    if (!roomName || !recordingId) {
      console.warn("[daily-recording-webhook] missing room_name or recording_id", data);
      return new Response(JSON.stringify({ ok: true, ignored: "missing fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Match the room_name back to one of our call tables.
    const callContext = await findCall(admin, roomName);
    if (!callContext) {
      console.warn("[daily-recording-webhook] no matching call for room", roomName);
      return new Response(JSON.stringify({ ok: true, ignored: "no matching call" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: Daily can fire both `recording.finished` and
    // `recording.ready-to-download` for the same recording. Reuse the existing
    // row if we've already logged this recording_id.
    const { data: existing } = await admin
      .from("call_transcripts")
      .select("id, status")
      .eq("recording_id", recordingId)
      .maybeSingle();

    let tRow: { id: string };
    if (existing) {
      if (downloadUrl) {
        await admin
          .from("call_transcripts")
          .update({ recording_url: downloadUrl, duration_seconds: duration ?? null })
          .eq("id", existing.id);
      }
      tRow = { id: existing.id };
      // Only re-kick transcription if the previous attempt hasn't succeeded.
      if (existing.status === "ready") {
        return new Response(JSON.stringify({ ok: true, transcript_id: tRow.id, dedup: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: inserted, error: tErr } = await admin
        .from("call_transcripts")
        .insert({
          call_kind: callContext.kind,
          call_id: callContext.id,
          project_id: callContext.project_id ?? null,
          circle_id: callContext.circle_id ?? null,
          recording_id: recordingId,
          recording_url: downloadUrl ?? null,
          duration_seconds: duration ?? null,
          participants: callContext.participants ?? [],
          status: "pending",
          created_by: callContext.host_id,
        })
        .select("id")
        .single();
      if (tErr) {
        console.error("[daily-recording-webhook] insert transcript failed", tErr);
        throw tErr;
      }
      tRow = inserted;
    }


    // Fire-and-forget the heavy transcription job. We respond to Daily fast.
    const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/transcribe-call`;
    fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ transcript_id: tRow.id, recording_id: recordingId }),
    }).catch((e) => console.warn("[daily-recording-webhook] kickoff failed", e));

    return new Response(JSON.stringify({ ok: true, transcript_id: tRow.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[daily-recording-webhook] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function findCall(admin: any, roomName: string): Promise<{
  kind: "project" | "direct" | "circle" | "meeting" | "event" | "sound_stage" | "speed_session" | "curated_stage";
  id: string;
  host_id: string;
  project_id?: string;
  circle_id?: string;
  participants?: any[];
} | null> {
  // Stage rooms follow a `<prefix>-<id>` convention:
  //   ss- → sound_stages (spontaneous Clubhouse-style)
  //   sp- → speed_sessions (Hi-Right-Now style rotations)
  //   cs- → curated_stages (scheduled Showcase / Scout)
  // Match by room_name first, then fall back to room_url suffix.
  const stageTables: Array<{ prefix: string; table: string; kind: "sound_stage" | "speed_session" | "curated_stage"; circleCol: boolean }> = [
    { prefix: "ss-", table: "sound_stages", kind: "sound_stage", circleCol: false },
    { prefix: "sp-", table: "speed_sessions", kind: "speed_session", circleCol: true },
    { prefix: "cs-", table: "curated_stages", kind: "curated_stage", circleCol: false },
  ];
  for (const s of stageTables) {
    if (!roomName.startsWith(s.prefix)) continue;
    const cols = s.circleCol
      ? "id, host_user_id, circle_id, room_name, room_url"
      : "id, host_user_id, room_name, room_url";
    const { data: row } = await admin
      .from(s.table)
      .select(cols)
      .or(`room_name.eq.${roomName},room_url.ilike.%/${roomName}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row) {
      return {
        kind: s.kind,
        id: row.id,
        host_id: row.host_user_id,
        circle_id: s.circleCol ? row.circle_id ?? undefined : undefined,
      };
    }
  }

  // Multi-party meetings (the new /meet/:id flow). Match by exact room_name.
  const { data: mtg } = await admin
    .from("meetings")
    .select("id, host_id, project_id, circle_id, source, room_name")
    .eq("room_name", roomName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mtg) {
    return {
      kind: mtg.source === "event" ? "event" : "meeting",
      id: mtg.id,
      host_id: mtg.host_id,
      project_id: mtg.project_id ?? undefined,
      circle_id: mtg.circle_id ?? undefined,
    };
  }

  // Project rooms are named `td-<projectIdNoDash>`. The video_room_url on the
  // project ends with the room_name, so we can search by URL suffix.
  const { data: pCall } = await admin
    .from("project_video_calls")
    .select("id, project_id, started_by, participants, room_url")
    .ilike("room_url", `%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pCall) {
    return {
      kind: "project",
      id: pCall.id,
      host_id: pCall.started_by,
      project_id: pCall.project_id,
      participants: pCall.participants,
    };
  }

  const { data: dCall } = await admin
    .from("direct_video_calls")
    .select("id, started_by, invited_user_id, participants, room_name, room_url")
    .or(`room_name.eq.${roomName},room_url.ilike.%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dCall) {
    return {
      kind: "direct",
      id: dCall.id,
      host_id: dCall.started_by,
      participants: dCall.participants,
    };
  }

  const { data: cCall } = await admin
    .from("circle_video_calls")
    .select("id, circle_id, started_by, participants, room_name, room_url")
    .or(`room_name.eq.${roomName},room_url.ilike.%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cCall) {
    return {
      kind: "circle",
      id: cCall.id,
      host_id: cCall.started_by,
      circle_id: cCall.circle_id,
      participants: cCall.participants,
    };
  }

  return null;
}
