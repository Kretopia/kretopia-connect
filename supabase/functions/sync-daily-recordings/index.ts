// Poll-based fallback that queries Daily's REST API for finished
// recordings and inserts/updates rows in call_transcripts — independent of
// the Daily → Supabase webhook (which isn't reliably configured in every
// environment). Called from the client right after a call ends, and also
// exposed as a manual "Sync now" button on /recordings.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_API = "https://api.daily.co/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: claims } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const roomName: string | undefined = body?.room_name;
    // How many recent Daily recordings to scan when no room_name is given.
    const limit = Math.min(Math.max(Number(body?.limit ?? 25), 1), 100);

    // 1) Fetch recordings from Daily
    const url = roomName
      ? `${DAILY_API}/recordings?room_name=${encodeURIComponent(roomName)}`
      : `${DAILY_API}/recordings?limit=${limit}`;
    const dRes = await fetch(url, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });
    if (!dRes.ok) {
      const t = await dRes.text();
      throw new Error(`Daily list failed: ${dRes.status} ${t}`);
    }
    const dJson = await dRes.json();
    const recordings: any[] = Array.isArray(dJson?.data) ? dJson.data : [];

    const results: Array<{ recording_id: string; transcript_id?: string; skipped?: string; error?: string }> = [];

    for (const rec of recordings) {
      const recordingId = rec.id;
      const rName = rec.room_name;
      if (!recordingId || !rName) continue;
      // Only recordings that have finished processing have a downloadable link.
      if (rec.status && rec.status !== "finished") {
        results.push({ recording_id: recordingId, skipped: `status=${rec.status}` });
        continue;
      }

      const ctx = await findCall(admin, rName);
      if (!ctx) {
        results.push({ recording_id: recordingId, skipped: "no matching call" });
        continue;
      }

      // Idempotency: reuse existing row if we've seen this recording before.
      const { data: existing } = await admin
        .from("call_transcripts")
        .select("id, status")
        .eq("recording_id", recordingId)
        .maybeSingle();

      // Mint a fresh, short-lived download link.
      let downloadUrl: string | null = null;
      try {
        const linkRes = await fetch(`${DAILY_API}/recordings/${recordingId}/access-link`, {
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        });
        if (linkRes.ok) {
          const lj = await linkRes.json();
          downloadUrl = lj?.download_link ?? null;
        }
      } catch (e) {
        console.warn("[sync-daily-recordings] access-link failed", e);
      }

      let transcriptId: string;
      if (existing) {
        if (downloadUrl) {
          await admin
            .from("call_transcripts")
            .update({ recording_url: downloadUrl, duration_seconds: rec.duration ?? null })
            .eq("id", existing.id);
        }
        transcriptId = existing.id;
        if (existing.status === "ready") {
          results.push({ recording_id: recordingId, transcript_id: transcriptId, skipped: "already ready" });
          continue;
        }
      } else {
        const { data: inserted, error: iErr } = await admin
          .from("call_transcripts")
          .insert({
            call_kind: ctx.kind,
            call_id: ctx.id,
            project_id: ctx.project_id ?? null,
            circle_id: ctx.circle_id ?? null,
            recording_id: recordingId,
            recording_url: downloadUrl ?? null,
            duration_seconds: rec.duration ?? null,
            participants: ctx.participants ?? [],
            status: "pending",
            created_by: ctx.host_id,
          })
          .select("id")
          .single();
        if (iErr) {
          console.error("[sync-daily-recordings] insert failed", iErr);
          results.push({ recording_id: recordingId, error: iErr.message });
          continue;
        }
        transcriptId = inserted!.id;
      }

      // Fire-and-forget transcription — same as the webhook path.
      const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/transcribe-call`;
      fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ transcript_id: transcriptId, recording_id: recordingId }),
      }).catch((e) => console.warn("[sync-daily-recordings] kickoff failed", e));

      results.push({ recording_id: recordingId, transcript_id: transcriptId });
    }

    return json({ ok: true, scanned: recordings.length, results });
  } catch (e) {
    console.error("[sync-daily-recordings]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findCall(admin: any, roomName: string): Promise<{
  kind: "project" | "direct" | "circle" | "meeting" | "event" | "sound_stage" | "speed_session" | "curated_stage";
  id: string;
  host_id: string;
  project_id?: string;
  circle_id?: string;
  participants?: any[];
} | null> {
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
    if (row) return { kind: s.kind, id: row.id, host_id: row.host_user_id, circle_id: s.circleCol ? row.circle_id ?? undefined : undefined };
  }

  const { data: mtg } = await admin
    .from("meetings")
    .select("id, host_id, project_id, circle_id, source, room_name")
    .eq("room_name", roomName)
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

  const { data: pCall } = await admin
    .from("project_video_calls")
    .select("id, project_id, started_by, participants, room_url")
    .ilike("room_url", `%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pCall) {
    return { kind: "project", id: pCall.id, host_id: pCall.started_by, project_id: pCall.project_id, participants: pCall.participants };
  }

  const { data: dCall } = await admin
    .from("direct_video_calls")
    .select("id, started_by, participants, room_name, room_url")
    .or(`room_name.eq.${roomName},room_url.ilike.%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dCall) return { kind: "direct", id: dCall.id, host_id: dCall.started_by, participants: dCall.participants };

  const { data: cCall } = await admin
    .from("circle_video_calls")
    .select("id, circle_id, started_by, participants, room_name, room_url")
    .or(`room_name.eq.${roomName},room_url.ilike.%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cCall) return { kind: "circle", id: cCall.id, host_id: cCall.started_by, circle_id: cCall.circle_id, participants: cCall.participants };

  return null;
}
