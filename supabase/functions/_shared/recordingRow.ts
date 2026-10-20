// The one place that creates the canonical call_transcripts row for a Daily recording and queues its
// transcript job. Used by daily-recording-webhook (Daily pushes) and sync-daily-recordings (we pull), so
// both paths agree on what "this recording is stored" means and neither can create a second row.
//
// A unique index on recording_id (migration 20261020160000) makes the database refuse a second row, so the
// loser of a race gets a unique violation and reads the winner back. The older safeguard stays for a database
// without that index: the insert is followed by a read of every row for that recording, ordered (created_at,
// id); the first one wins and any other inserter deletes the row it just made. Both inserters see the same
// order, so exactly one survives. The deleted row has no transcript yet, so nothing is lost.

import { shouldQueueTranscription, type QueueDecisionRow } from "./recordingTranscript.ts";

// The query builder is chained dynamically; its real type lives in the Deno-only supabase-js import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = { from: (table: string) => any };

export interface RecordingCallContext {
  kind: string;
  id: string;
  host_id: string;
  project_id?: string;
  circle_id?: string;
  participants?: unknown[];
}

export interface TranscriptRowRef extends QueueDecisionRow {
  id: string;
  /** True only for the caller whose insert created the row that survives. */
  created: boolean;
}

export async function ensureTranscriptRow(
  admin: AdminClient,
  input: {
    recordingId: string;
    call: RecordingCallContext;
    /** Daily's short-lived download link, when the event carries one. */
    downloadUrl?: string | null;
    durationSeconds?: number | null;
  },
): Promise<TranscriptRowRef> {
  const list = async (): Promise<Array<QueueDecisionRow & { id: string }>> => {
    const { data, error } = await admin
      .from("call_transcripts")
      .select("id, status, error, created_at")
      .eq("recording_id", input.recordingId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw new Error(`call_transcripts lookup failed: ${error.message}`);
    return Array.isArray(data) ? data : [];
  };

  const existing = (await list())[0];
  if (existing) {
    // Only write what the event actually carries: a replay without a duration must not blank a good one.
    const patch: Record<string, unknown> = {};
    if (input.downloadUrl) patch.recording_url = input.downloadUrl;
    if (typeof input.durationSeconds === "number" && Number.isFinite(input.durationSeconds)) {
      patch.duration_seconds = Math.round(input.durationSeconds);
    }
    if (Object.keys(patch).length) {
      const { error } = await admin.from("call_transcripts").update(patch).eq("id", existing.id);
      if (error) console.warn("[recordingRow] refresh of existing row failed", error.message);
    }
    return { ...existing, created: false };
  }

  const { data: inserted, error: insertErr } = await admin
    .from("call_transcripts")
    .insert({
      call_kind: input.call.kind,
      call_id: input.call.id,
      project_id: input.call.project_id ?? null,
      circle_id: input.call.circle_id ?? null,
      recording_id: input.recordingId,
      recording_url: input.downloadUrl ?? null,
      duration_seconds:
        typeof input.durationSeconds === "number" && Number.isFinite(input.durationSeconds)
          ? Math.round(input.durationSeconds)
          : null,
      participants: input.call.participants ?? [],
      status: "pending",
      created_by: input.call.host_id,
    })
    .select("id");
  if (insertErr) {
    // 23505 = unique violation: another delivery inserted this recording first, and its row is the answer.
    if (insertErr.code === "23505") {
      const winner = (await list())[0];
      if (winner) return { ...winner, created: false };
    }
    throw new Error(`call_transcripts insert failed: ${insertErr.message}`);
  }
  const myId: string | undefined = Array.isArray(inserted) ? inserted[0]?.id : (inserted as { id?: string } | null)?.id;
  if (!myId) throw new Error("call_transcripts insert returned no id");

  const rows = await list();
  const winner = rows[0];
  if (winner && winner.id !== myId) {
    const { error } = await admin.from("call_transcripts").delete().eq("id", myId);
    if (error) console.warn("[recordingRow] could not remove the duplicate row", myId, error.message);
    return { ...winner, created: false };
  }
  return { id: myId, status: "pending", error: null, created_at: winner?.created_at ?? new Date().toISOString(), created: true };
}

/** Keeps the worker alive until `task` settles, when the runtime supports it; otherwise lets it run. */
export function runInBackground(task: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(task);
}

/**
 * Starts the transcript job for a row and makes sure a job that never ran does not leave the row looking
 * busy. transcribe-call records its own failures, so a failure answer from it is left alone; only a row
 * that is still pending/transcribing after a failed or unreachable job is marked failed, which is what
 * lets a retry or "Sync now" pick it up. Never rejects.
 */
export async function dispatchTranscription(
  admin: AdminClient,
  args: { transcriptId: string; recordingId: string; currentStatus?: string; fetchFn?: typeof fetch },
): Promise<"dispatched" | "failed"> {
  const doFetch = args.fetchFn ?? fetch;
  const markNotRun = async (why: string) => {
    try {
      await admin
        .from("call_transcripts")
        .update({ status: "failed", error: why })
        .eq("id", args.transcriptId)
        .in("status", ["pending", "transcribing"]);
    } catch (e) {
      console.warn("[recordingRow] could not record the failed dispatch", e);
    }
  };

  try {
    // transcribe-call only claims pending/failed rows; a job that stopped moving is released first.
    if (args.currentStatus === "transcribing") {
      await admin.from("call_transcripts").update({ status: "pending" }).eq("id", args.transcriptId).eq("status", "transcribing");
    }
    const res = await doFetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/transcribe-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ transcript_id: args.transcriptId, recording_id: args.recordingId }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) return "dispatched";
    await markNotRun(`Transcription did not complete (HTTP ${res.status}).`);
    return "failed";
  } catch (e) {
    // Timing out only means we stopped waiting: the job keeps running in its own worker.
    if (e instanceof DOMException && e.name === "TimeoutError") return "dispatched";
    await markNotRun(`Transcription could not be started: ${e instanceof Error ? e.message : "unknown error"}`);
    return "failed";
  }
}

export { shouldQueueTranscription };
