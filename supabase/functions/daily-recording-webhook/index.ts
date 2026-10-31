// Daily.co webhook receiver.
// Daily fires `recording.ready-to-download` once a cloud recording has
// finished processing. We acknowledge fast (under 5s — Daily requirement):
// the canonical call_transcripts row is written BEFORE we answer 2xx, and the
// slow transcript job is queued in the background (EdgeRuntime.waitUntil).
//
// What the status codes mean, so a failure is never reported as success:
//   200  nothing for us to do (test ping, an event that is not a finished
//        recording, or a recording from a room that is not one of ours — the
//        Daily key is account-wide), or the row exists / already existed.
//   400  a signed "finished recording" event that lacks its room or recording id.
//   401  missing/bad signature, or a timestamp outside the freshness window.
//   500  required work failed (misconfiguration, database error): Daily retries.
// Replays are idempotent: one row per recording_id, no second transcript job.
//
// Configure in Daily dashboard → Webhooks:
//   URL: https://<project>.functions.supabase.co/daily-recording-webhook
//   Events: recording.ready-to-download
//   (Optional) HMAC secret → set DAILY_WEBHOOK_HMAC_SECRET

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkWebhookTimestamp } from "../_shared/webhookFreshness.ts";
import { dispatchTranscription, ensureTranscriptRow, runInBackground } from "../_shared/recordingRow.ts";
import { findCallByRoom } from "../_shared/findCallByRoom.ts";
import { shouldQueueTranscription } from "../_shared/recordingTranscript.ts";


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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(async (req) => {

  try {
    const raw = await req.text();

    // ===== Signature validation — mandatory =====
    const hmacSecret = Deno.env.get("DAILY_WEBHOOK_HMAC_SECRET");
    if (!hmacSecret) {
      console.error("[daily-recording-webhook] DAILY_WEBHOOK_HMAC_SECRET not set");
      return new Response(
        JSON.stringify({ error: "misconfigured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    // Daily signs with HMAC-SHA256(timestamp + "." + body). It sends
    // `x-webhook-signature` (hex) and `x-webhook-timestamp` (unix seconds).
    // Fall back to a raw-body signature for older webhook configs.
    const incomingSig = (req.headers.get("x-webhook-signature") || "").trim().toLowerCase();
    const timestamp = (req.headers.get("x-webhook-timestamp") || "").trim();
    if (!incomingSig) {
      return new Response("missing signature", { status: 401, });
    }
    const timestampedSig = timestamp ? await hmacSha256Hex(hmacSecret, `${timestamp}.${raw}`) : null;
    const rawBodySig = await hmacSha256Hex(hmacSecret, raw);
    const timestampedOk = timestampedSig !== null && timingSafeEqualHex(timestampedSig, incomingSig);
    const rawBodyOk = timingSafeEqualHex(rawBodySig, incomingSig);
    if (!timestampedOk && !rawBodyOk) {
      console.warn("[daily-recording-webhook] signature mismatch");
      return new Response("bad signature", { status: 401, });
    }

    // Freshness (audit GA REL-04). The timestamped signature covers `${timestamp}.${body}`, so a captured
    // request stays genuine forever unless its timestamp is bounded. Only the timestamped form can be
    // bounded; the raw-body form carries no time and is kept for older webhook configs (logged below).
    if (timestampedOk) {
      const fresh = checkWebhookTimestamp(timestamp, Math.floor(Date.now() / 1000));
      if (!fresh.ok) {
        console.warn("[daily-recording-webhook] rejected:", fresh.reason);
        return new Response("stale or invalid timestamp", { status: 401, });
      }
    } else {
      console.warn("[daily-recording-webhook] accepted a raw-body signature: its age cannot be bounded");
    }

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch (_) {
      return json({ error: "body is not JSON" }, 400);
    }
    const event = payload?.type ?? payload?.event ?? "";

    // Daily echoes a `test` event when you save the webhook in their dashboard.
    if (event === "test" || event === "ping") return json({ ok: true });

    // Only a finished recording is stored. `recording.started` needs nothing from us, and
    // `recording.error` carries no recording id (nothing was stored), so neither has a row to write.
    if (event !== "recording.ready-to-download" && event !== "recording.finished") {
      if (event === "recording.error") {
        console.warn("[daily-recording-webhook] Daily reported a recording error", {
          room: payload?.payload?.room_name ?? payload?.room_name,
          message: payload?.payload?.error_msg ?? payload?.error_msg,
        });
      } else {
        console.log("[daily-recording-webhook] ignoring event:", event);
      }
      return json({ ok: true, ignored: `event ${event || "(none)"}` });
    }

    const data = payload?.payload ?? payload?.data ?? payload;
    const roomName: string | undefined = data?.room_name ?? data?.room;
    const recordingId: string | undefined = data?.recording_id ?? data?.id;
    const downloadUrl: string | undefined = data?.download_link ?? data?.download_url;
    const duration: number | undefined = typeof data?.duration === "number" ? data.duration : undefined;

    if (!roomName || !recordingId) {
      console.warn("[daily-recording-webhook] missing room_name or recording_id", data);
      return json({ error: "room_name and recording_id are required" }, 400);
    }
    // Daily room names are [A-Za-z0-9_-]; anything else is never interpolated into a query.
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(roomName) || typeof recordingId !== "string" || recordingId.length > 200) {
      return json({ error: "room_name or recording_id is malformed" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Match the room_name back to one of our call tables.
    const callContext = await findCallByRoom(admin, roomName);
    if (!callContext) {
      // Not an error: the Daily key is account-wide, so recordings of rooms that are not ours arrive here.
      console.warn("[daily-recording-webhook] no matching call for room", roomName);
      return json({ ok: true, ignored: "no matching call" });
    }

    // The canonical row first: a 2xx below means it exists. A database failure throws -> 500 -> Daily retries.
    // One row per recording_id even when Daily delivers the event twice at once (see _shared/recordingRow.ts).
    const row = await ensureTranscriptRow(admin, {
      recordingId,
      call: callContext,
      downloadUrl: downloadUrl ?? null,
      durationSeconds: duration ?? null,
    });

    // Queue the slow transcript job in the background, only when this row needs one: a replay of an
    // event whose job is running or done must not start a second job (it would duplicate action items).
    const queue = row.created || shouldQueueTranscription(row);
    if (queue) {
      runInBackground(
        dispatchTranscription(admin, { transcriptId: row.id, recordingId, currentStatus: row.status }),
      );
    }

    return json({ ok: true, transcript_id: row.id, created: row.created, dedup: !row.created, queued: queue });
  } catch (e) {
    console.error("[daily-recording-webhook] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
