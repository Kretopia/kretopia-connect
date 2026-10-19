// Poll-based fallback that queries Daily's REST API for finished
// recordings and inserts/updates rows in call_transcripts — independent of
// the Daily → Supabase webhook (which isn't reliably configured in every
// environment). Called from the client after a call ends (and again, with a
// widening gap, until the recording is stored), and exposed as a manual
// "Sync now" button on /recordings.
//
// Optional body: { room_name, limit, since_ts }. `since_ts` (unix seconds) restricts the scan to
// recordings that started at or after it — the client passes the call's start so that "the recording
// of THIS call is stored" can be told apart from the room's older recordings — and is echoed back so
// the client can tell an answer to that question from an older deployment that ignores it.
//
// Status codes: 200 with `ok:false` + `failed` when some recordings could not be saved (the rest are
// in `results`), 502 when recordings were found but none could be saved, 500 when the scan itself
// failed. A failure is never reported as a clean 200.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { userMayActOnCall } from "../_shared/projectAccess.ts";
import { dispatchTranscription, ensureTranscriptRow, runInBackground } from "../_shared/recordingRow.ts";
import { findCallByRoom } from "../_shared/findCallByRoom.ts";
import { shouldQueueTranscription } from "../_shared/recordingTranscript.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_API = "https://api.daily.co/v1";

/** Daily recording statuses that will never become downloadable. */
const TERMINAL_UNUSABLE = new Set(["canceled", "cancelled", "failed", "error"]);

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
    // Daily room names are [A-Za-z0-9_-]; reject anything else before it is
    // interpolated into the Daily URL.
    if (roomName !== undefined && (typeof roomName !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(roomName))) {
      return json({ error: "invalid room_name" }, 400);
    }
    // A unix-seconds timestamp, not in the future by more than a day.
    const rawSince = body?.since_ts;
    let sinceTs: number | null = null;
    if (rawSince !== undefined && rawSince !== null) {
      if (!Number.isInteger(rawSince) || rawSince <= 0 || rawSince > Math.floor(Date.now() / 1000) + 86_400) {
        return json({ error: "invalid since_ts" }, 400);
      }
      sinceTs = rawSince;
    }
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

    // The Daily key is account-wide, so the listing contains EVERY user's
    // recordings. Only recordings of calls the caller may act on are touched or
    // reported; everything else is skipped silently so ids don't leak.
    const projectAccessCache = new Map<string, boolean>();
    let scanned = 0;

    for (const rec of recordings) {
      const recordingId = rec.id;
      const rName = rec.room_name;
      if (!recordingId || !rName) continue;
      // Older than the call the client is asking about: not part of the answer.
      if (sinceTs !== null && typeof rec.start_ts === "number" && rec.start_ts < sinceTs) continue;

      let ctx;
      try {
        ctx = await findCallByRoom(admin, rName);
      } catch (e) {
        console.error("[sync-daily-recordings] call lookup failed", e);
        results.push({ recording_id: recordingId, error: "Could not look up the call for this recording" });
        continue;
      }
      if (!ctx) continue;
      const mayAct = await userMayActOnCall(admin, userId, ctx, {
        allowParticipant: true,
        cache: projectAccessCache,
      });
      if (!mayAct) continue;
      scanned++;

      // Only recordings that have finished processing have a downloadable link. A recording that
      // Daily cancelled never will, and is reported as such rather than as "still processing".
      if (rec.status && rec.status !== "finished") {
        const unusable = TERMINAL_UNUSABLE.has(String(rec.status).toLowerCase());
        results.push({ recording_id: recordingId, skipped: unusable ? `unavailable=${rec.status}` : `status=${rec.status}` });
        continue;
      }

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

      // The canonical row — one per recording_id, whoever creates it first (webhook or this sync).
      let row;
      try {
        row = await ensureTranscriptRow(admin, {
          recordingId,
          call: ctx,
          downloadUrl,
          durationSeconds: typeof rec.duration === "number" ? rec.duration : null,
        });
      } catch (e) {
        console.error("[sync-daily-recordings] row failed", e);
        results.push({ recording_id: recordingId, error: e instanceof Error ? e.message : "Could not save this recording" });
        continue;
      }

      if (row.status === "ready") {
        results.push({ recording_id: recordingId, transcript_id: row.id, skipped: "already ready" });
        continue;
      }

      // Queue the transcript job in the background, unless one is running or the transcript was skipped.
      if (row.created || shouldQueueTranscription(row)) {
        runInBackground(dispatchTranscription(admin, { transcriptId: row.id, recordingId, currentStatus: row.status }));
      }
      results.push({ recording_id: recordingId, transcript_id: row.id });
    }

    const failed = results.filter((r) => r.error).length;
    const saved = results.filter((r) => r.transcript_id).length;
    if (failed > 0 && saved === 0) {
      return json({ ok: false, error: "None of the recordings could be saved", scanned, failed, since_ts: sinceTs, results }, 502);
    }
    return json({ ok: failed === 0, scanned, failed, since_ts: sinceTs, results });
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
