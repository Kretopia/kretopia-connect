import { TRANSCRIPT_STALLED_AFTER_MS, isTranscriptSkipped } from "../../supabase/functions/_shared/recordingTranscript";

/**
 * One vocabulary for "what state is this recording in", on both sides of a call.
 *
 *  - Stored recordings (call_transcripts rows): the recording and its transcript are two different
 *    things. A row exists only after Daily reported the recording finished, so the replay is available
 *    even while, or when, the transcript is not. `status` only describes the transcript.
 *  - Live recordings (Daily events in the call): requested, recording, stopping, processing, saved, failed.
 *
 * Nothing here invents a state: a recording is "available" only when a stored row with a recording id
 * exists and its media has not been purged; anything the data cannot prove is not shown as available.
 */

// ── Stored recordings ─────────────────────────────────────────────────────────────────────────────

export type TranscriptStatus = "pending" | "transcribing" | "ready" | "failed";

export interface StoredRecordingFacts {
  status: TranscriptStatus;
  recording_id: string | null;
  /** Set by purge-expired-recordings once the media was deleted. The column may not exist yet. */
  recording_deleted_at?: string | null;
  error?: string | null;
  created_at?: string | null;
}

export type RecordingAvailability = "available" | "expired" | "none";
export type TranscriptPhase = "queued" | "processing" | "stalled" | "ready" | "skipped" | "failed";
export type RecordingTone = "progress" | "success" | "warning" | "danger";

export interface StoredRecordingState {
  availability: RecordingAvailability;
  transcript: TranscriptPhase;
  /** The replay can be requested (the link itself is minted, and access-checked, on click). */
  canReplay: boolean;
  /** The recap (summary, action items) exists. */
  canOpenRecap: boolean;
  /** The transcript is still being produced, so the list is worth refreshing. */
  inProgress: boolean;
  recordingLabel: string;
  transcriptLabel: string;
  transcriptDetail: string | null;
  tone: RecordingTone;
}

/** A transcript that has been pending or transcribing this long is not "in progress" any more (the server re-queues it after the same delay). */
export { TRANSCRIPT_STALLED_AFTER_MS };

export function describeStoredRecording(f: StoredRecordingFacts, now: number = Date.now()): StoredRecordingState {
  const availability: RecordingAvailability = !f.recording_id ? "none" : f.recording_deleted_at ? "expired" : "available";
  const canReplay = availability === "available";

  let transcript: TranscriptPhase;
  if (f.status === "ready") transcript = "ready";
  else if (f.status === "failed") transcript = isTranscriptSkipped(f.error) ? "skipped" : "failed";
  else {
    const created = f.created_at ? Date.parse(f.created_at) : NaN;
    const stalled = Number.isFinite(created) && now - created > TRANSCRIPT_STALLED_AFTER_MS;
    transcript = stalled ? "stalled" : f.status === "transcribing" ? "processing" : "queued";
  }

  const replayNote = canReplay ? " The replay is still available." : "";
  const copy: Record<TranscriptPhase, { label: string; detail: string | null; tone: RecordingTone }> = {
    queued: { label: "Recap queued", detail: null, tone: "progress" },
    processing: { label: "Kreto listening…", detail: null, tone: "progress" },
    stalled: {
      label: "Recap delayed",
      detail: "This is taking longer than usual. Tap Sync now to retry.",
      tone: "warning",
    },
    ready: { label: "Recap ready", detail: null, tone: "success" },
    skipped: {
      label: "No recap",
      detail: `This recording is too long for automatic transcription.${replayNote}`,
      tone: "warning",
    },
    failed: { label: "Recap failed", detail: `Kreto couldn't transcribe this call.${replayNote}`, tone: "danger" },
  };

  return {
    availability,
    transcript,
    canReplay,
    canOpenRecap: transcript === "ready",
    inProgress: transcript === "queued" || transcript === "processing",
    recordingLabel:
      availability === "available" ? "Replay available" : availability === "expired" ? "Replay expired" : "No recording",
    transcriptLabel: copy[transcript].label,
    transcriptDetail: copy[transcript].detail,
    tone: copy[transcript].tone,
  };
}

// ── Live recordings (inside a call) ────────────────────────────────────────────────────────────────

export type LiveRecordingPhase = "idle" | "requested" | "recording" | "stopping" | "processing" | "saved" | "failed";

export type LiveRecordingEvent =
  | { type: "start-requested" }
  | { type: "started" }
  | { type: "stop-requested" }
  | { type: "stopped" }
  | { type: "saved" }
  | { type: "error"; message?: string | null }
  | { type: "reset" };

export interface LiveRecordingState {
  phase: LiveRecordingPhase;
  /** When Daily reported the recording started (ms epoch); null unless phase is "recording" or "stopping". */
  startedAt: number | null;
  error: string | null;
}

export const IDLE_RECORDING: LiveRecordingState = { phase: "idle", startedAt: null, error: null };

/**
 * Pure reducer over the events a call produces. Daily has no pause, so there is no paused phase.
 * `started` is accepted from any phase: another participant may start the recording.
 */
export function reduceLiveRecording(
  state: LiveRecordingState,
  event: LiveRecordingEvent,
  now: number = Date.now(),
): LiveRecordingState {
  switch (event.type) {
    case "start-requested":
      return state.phase === "recording" || state.phase === "stopping"
        ? state
        : { phase: "requested", startedAt: null, error: null };
    case "started":
      return state.phase === "recording" || state.phase === "stopping"
        ? state
        : { phase: "recording", startedAt: now, error: null };
    case "stop-requested":
      return state.phase === "recording" ? { ...state, phase: "stopping" } : state;
    case "stopped":
      return state.phase === "recording" || state.phase === "stopping"
        ? { phase: "processing", startedAt: null, error: null }
        : state;
    case "saved":
      return state.phase === "processing" ? { phase: "saved", startedAt: null, error: null } : state;
    case "error":
      return { phase: "failed", startedAt: null, error: event.message?.trim() || "The recording could not be started." };
    case "reset":
      return IDLE_RECORDING;
  }
}

export interface LiveRecordingCopy {
  label: string;
  tone: "neutral" | "progress" | "danger" | "success";
}

export function liveRecordingCopy(phase: LiveRecordingPhase): LiveRecordingCopy | null {
  switch (phase) {
    case "idle":
      return null;
    case "requested":
      return { label: "Starting recording…", tone: "progress" };
    case "recording":
      return { label: "Recording", tone: "danger" };
    case "stopping":
      return { label: "Stopping recording…", tone: "progress" };
    case "processing":
      return { label: "Saving recording…", tone: "progress" };
    case "saved":
      return { label: "Saved to Recordings", tone: "success" };
    case "failed":
      return { label: "Recording failed", tone: "danger" };
  }
}

/** The Record/Stop button should act as "Stop" only while a recording is actually running. */
export const isRecordingActive = (phase: LiveRecordingPhase): boolean => phase === "recording" || phase === "stopping";
