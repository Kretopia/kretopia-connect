// Pure, dependency-free vocabulary for "the recording is stored, but its transcript was not produced".
// Imported by edge functions (Deno), by the Recordings UI and by tests (Vite).
//
// Why this exists: call_transcripts.status only says how the TRANSCRIPT went (pending, transcribing,
// ready, failed). A recording is stored and replayable the moment Daily reports it finished, long before
// (or without) a transcript. transcribe-call used to throw when a recording was over its inline size cap
// and the row was stamped "failed", so a perfectly good recording looked broken, and the webhook that
// fired the job had already answered 200. The check constraint on status cannot take a new value without
// a migration, so a transcript that was deliberately skipped is recorded as status "failed" plus an
// `error` that starts with TRANSCRIPT_SKIPPED_PREFIX. Anything else in `error` is a real failure.

/** Largest recording the inline Gemini call can take: buffer + base64 + JSON body must fit an edge worker. */
export const INLINE_TRANSCRIPT_MAX_BYTES = 8 * 1024 * 1024;

export const TRANSCRIPT_SKIPPED_PREFIX = "transcript_skipped:";

export type TranscriptSkipReason = "too_large";

/** The `error` value that marks a deliberate skip. `detail` is human-readable context after the code. */
export function transcriptSkippedError(reason: TranscriptSkipReason, detail?: string): string {
  return `${TRANSCRIPT_SKIPPED_PREFIX}${reason}${detail ? ` (${detail})` : ""}`;
}

// Rows written before this module existed carry transcribe-call's old message verbatim.
const LEGACY_TOO_LARGE = /^Recording too large for inline transcription/i;

/** True when the row's transcript was skipped on purpose (not a failure of the pipeline). */
export function isTranscriptSkipped(error: string | null | undefined): boolean {
  if (typeof error !== "string") return false;
  return error.startsWith(TRANSCRIPT_SKIPPED_PREFIX) || LEGACY_TOO_LARGE.test(error);
}

/** Why a skipped transcript was skipped, or null when it was not skipped. */
export function transcriptSkipReason(error: string | null | undefined): TranscriptSkipReason | null {
  return isTranscriptSkipped(error) ? "too_large" : null;
}

/** A transcript job that has not moved for this long is treated as lost and may be queued again. */
export const TRANSCRIPT_STALLED_AFTER_MS = 20 * 60 * 1000;
/** A row still "pending" this long after it was created never had its job picked up. */
export const TRANSCRIPT_UNSTARTED_AFTER_MS = 2 * 60 * 1000;

export interface QueueDecisionRow {
  status: string;
  error?: string | null;
  created_at?: string | null;
}

/**
 * Should a webhook/sync that finds this row queue a transcript job?
 *
 * A job that is already running or done must not be queued twice (the job inserts action items, so a
 * second run would duplicate them), and a transcript that was skipped on purpose is final. Daily can
 * deliver the same event more than once within seconds, so a fresh "pending" row is left alone: only a
 * row whose job evidently never started (pending for a couple of minutes) or never finished (running for
 * 20 minutes) is queued again. A failed transcript is retried: that is what a retry or "Sync now" is for.
 */
export function shouldQueueTranscription(row: QueueDecisionRow | null | undefined, now: number = Date.now()): boolean {
  if (!row) return true;
  if (row.status === "ready") return false;
  if (row.status === "failed") return !isTranscriptSkipped(row.error);
  const created = row.created_at ? Date.parse(row.created_at) : NaN;
  const age = Number.isFinite(created) ? now - created : Number.POSITIVE_INFINITY;
  if (row.status === "pending") return age > TRANSCRIPT_UNSTARTED_AFTER_MS;
  if (row.status === "transcribing") return age > TRANSCRIPT_STALLED_AFTER_MS;
  return false;
}
