import { describe, expect, it } from "vitest";
import {
  IDLE_RECORDING,
  TRANSCRIPT_STALLED_AFTER_MS,
  describeStoredRecording,
  isRecordingActive,
  liveRecordingCopy,
  reduceLiveRecording,
  type LiveRecordingState,
  type StoredRecordingFacts,
} from "../recordingState";
import {
  TRANSCRIPT_SKIPPED_PREFIX,
  isTranscriptSkipped,
  transcriptSkippedError,
} from "../../../supabase/functions/_shared/recordingTranscript";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const row = (over: Partial<StoredRecordingFacts> = {}): StoredRecordingFacts => ({
  status: "ready",
  recording_id: "rec_1",
  recording_deleted_at: null,
  error: null,
  created_at: new Date(NOW - 60_000).toISOString(),
  ...over,
});

describe("describeStoredRecording: a stored recording and its transcript are two different things", () => {
  it("a ready recap with a replay", () => {
    const s = describeStoredRecording(row(), NOW);
    expect(s).toMatchObject({ availability: "available", transcript: "ready", canReplay: true, canOpenRecap: true, inProgress: false });
    expect(s.transcriptLabel).toBe("Recap ready");
  });

  it("a transcript that was skipped on purpose (new marker) keeps the replay and says why", () => {
    const s = describeStoredRecording(row({ status: "failed", error: transcriptSkippedError("too_large", "42 MB") }), NOW);
    expect(s).toMatchObject({ availability: "available", transcript: "skipped", canReplay: true, canOpenRecap: false });
    expect(s.transcriptLabel).toBe("No recap");
    expect(s.transcriptDetail).toMatch(/too long for automatic transcription/);
    expect(s.transcriptDetail).toMatch(/replay is still available/i);
  });

  it("recognises the message transcribe-call wrote before the marker existed (every row in production today)", () => {
    const legacy = "Recording too large for inline transcription (42529331 bytes, max 8388608). Chunking not yet implemented.";
    expect(isTranscriptSkipped(legacy)).toBe(true);
    expect(describeStoredRecording(row({ status: "failed", error: legacy }), NOW).transcript).toBe("skipped");
  });

  it("a real failure stays a failure, and still does not hide the replay", () => {
    for (const error of ["Gemini error 500: boom", "AI credits exhausted.", "Daily access-link failed: 404", null]) {
      const s = describeStoredRecording(row({ status: "failed", error }), NOW);
      expect(s).toMatchObject({ transcript: "failed", canReplay: true, canOpenRecap: false, tone: "danger" });
    }
  });

  it("queued and processing transcripts are in progress; a stale one is delayed, not in progress", () => {
    expect(describeStoredRecording(row({ status: "pending" }), NOW)).toMatchObject({ transcript: "queued", inProgress: true });
    expect(describeStoredRecording(row({ status: "transcribing" }), NOW)).toMatchObject({ transcript: "processing", inProgress: true });
    const old = new Date(NOW - TRANSCRIPT_STALLED_AFTER_MS - 1000).toISOString();
    for (const status of ["pending", "transcribing"] as const) {
      const s = describeStoredRecording(row({ status, created_at: old }), NOW);
      expect(s).toMatchObject({ transcript: "stalled", inProgress: false, tone: "warning" });
      expect(s.transcriptDetail).toMatch(/Sync now/);
    }
  });

  it("never shows a recording as available when the data cannot prove it", () => {
    expect(describeStoredRecording(row({ recording_id: null }), NOW)).toMatchObject({ availability: "none", canReplay: false });
    const purged = describeStoredRecording(row({ recording_deleted_at: "2026-10-01T00:00:00Z" }), NOW);
    expect(purged).toMatchObject({ availability: "expired", canReplay: false, recordingLabel: "Replay expired" });
    // an expired replay is never promised in the transcript note either
    const purgedFailed = describeStoredRecording(
      row({ recording_deleted_at: "2026-10-01T00:00:00Z", status: "failed", error: "Gemini error 500" }),
      NOW,
    );
    expect(purgedFailed.transcriptDetail).not.toMatch(/replay is still available/i);
  });

  it("the skip marker is a prefix, so a stray substring elsewhere is not a skip", () => {
    expect(isTranscriptSkipped(`${TRANSCRIPT_SKIPPED_PREFIX}too_large`)).toBe(true);
    expect(isTranscriptSkipped("fetch failed: transcript_skipped:too_large")).toBe(false);
    expect(isTranscriptSkipped(undefined)).toBe(false);
  });
});

describe("reduceLiveRecording: the recording lifecycle inside a call", () => {
  const run = (events: Parameters<typeof reduceLiveRecording>[1][], from: LiveRecordingState = IDLE_RECORDING, t = 1000) =>
    events.reduce((s, e, i) => reduceLiveRecording(s, e, t + i), from);

  it("requested -> recording -> stopping -> processing -> saved", () => {
    expect(run([{ type: "start-requested" }]).phase).toBe("requested");
    expect(run([{ type: "start-requested" }, { type: "started" }])).toMatchObject({ phase: "recording", startedAt: 1001 });
    expect(run([{ type: "start-requested" }, { type: "started" }, { type: "stop-requested" }]).phase).toBe("stopping");
    expect(run([{ type: "start-requested" }, { type: "started" }, { type: "stop-requested" }, { type: "stopped" }])).toMatchObject({
      phase: "processing",
      startedAt: null,
    });
    expect(
      run([{ type: "start-requested" }, { type: "started" }, { type: "stopped" }, { type: "saved" }]).phase,
    ).toBe("saved");
  });

  it("another participant starting or stopping the recording is followed", () => {
    expect(run([{ type: "started" }]).phase).toBe("recording");
    expect(run([{ type: "started" }, { type: "stopped" }]).phase).toBe("processing");
  });

  it("a repeated started event does not restart the clock", () => {
    const s = run([{ type: "started" }, { type: "started" }]);
    expect(s.startedAt).toBe(1000);
  });

  it("an error is a failed recording with a reason, and a new request recovers from it", () => {
    const failed = run([{ type: "start-requested" }, { type: "error", message: "Not allowed" }]);
    expect(failed).toMatchObject({ phase: "failed", error: "Not allowed", startedAt: null });
    expect(run([{ type: "error" }]).error).toMatch(/could not be started/i);
    expect(reduceLiveRecording(failed, { type: "start-requested" }).phase).toBe("requested");
  });

  it("ignores events that make no sense, instead of inventing a state", () => {
    expect(run([{ type: "stopped" }]).phase).toBe("idle");
    expect(run([{ type: "saved" }]).phase).toBe("idle");
    expect(run([{ type: "stop-requested" }]).phase).toBe("idle");
    expect(run([{ type: "started" }, { type: "start-requested" }]).phase).toBe("recording");
  });

  it("reset returns to idle; only recording/stopping count as active; idle has no copy", () => {
    expect(run([{ type: "started" }, { type: "reset" }])).toEqual(IDLE_RECORDING);
    expect(isRecordingActive("recording")).toBe(true);
    expect(isRecordingActive("stopping")).toBe(true);
    for (const p of ["idle", "requested", "processing", "saved", "failed"] as const) expect(isRecordingActive(p)).toBe(false);
    expect(liveRecordingCopy("idle")).toBeNull();
    expect(liveRecordingCopy("processing")?.label).toBe("Saving recording…");
    expect(liveRecordingCopy("recording")?.tone).toBe("danger");
  });
});
