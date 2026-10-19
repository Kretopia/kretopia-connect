import { describe, expect, it } from "vitest";
import {
  TRANSCRIPT_STALLED_AFTER_MS,
  TRANSCRIPT_UNSTARTED_AFTER_MS,
  shouldQueueTranscription,
  transcriptSkipReason,
  transcriptSkippedError,
} from "../../../supabase/functions/_shared/recordingTranscript";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("shouldQueueTranscription", () => {
  it("queues a brand-new recording (no row yet)", () => {
    expect(shouldQueueTranscription(null, NOW)).toBe(true);
  });
  it("never a finished transcript, never one skipped on purpose", () => {
    expect(shouldQueueTranscription({ status: "ready" }, NOW)).toBe(false);
    expect(shouldQueueTranscription({ status: "failed", error: transcriptSkippedError("too_large") }, NOW)).toBe(false);
  });
  it("a real failure is retried", () => {
    expect(shouldQueueTranscription({ status: "failed", error: "Gemini error 500" }, NOW)).toBe(true);
    expect(shouldQueueTranscription({ status: "failed" }, NOW)).toBe(true);
  });
  it("a pending row is left alone for two minutes (Daily double-delivers), then queued", () => {
    expect(shouldQueueTranscription({ status: "pending", created_at: ago(TRANSCRIPT_UNSTARTED_AFTER_MS - 1000) }, NOW)).toBe(false);
    expect(shouldQueueTranscription({ status: "pending", created_at: ago(TRANSCRIPT_UNSTARTED_AFTER_MS + 1000) }, NOW)).toBe(true);
  });
  it("a running job is left alone until it has been stalled for twenty minutes", () => {
    expect(shouldQueueTranscription({ status: "transcribing", created_at: ago(TRANSCRIPT_STALLED_AFTER_MS - 1000) }, NOW)).toBe(false);
    expect(shouldQueueTranscription({ status: "transcribing", created_at: ago(TRANSCRIPT_STALLED_AFTER_MS + 1000) }, NOW)).toBe(true);
  });
  it("a row with no readable age is treated as old rather than stuck forever", () => {
    expect(shouldQueueTranscription({ status: "pending" }, NOW)).toBe(true);
  });
  it("an unknown status is never queued", () => {
    expect(shouldQueueTranscription({ status: "weird" }, NOW)).toBe(false);
  });
});

describe("transcriptSkippedError", () => {
  it("is machine-readable and human-readable", () => {
    expect(transcriptSkippedError("too_large", "42 MB, limit 8 MB")).toBe("transcript_skipped:too_large (42 MB, limit 8 MB)");
    expect(transcriptSkipReason(transcriptSkippedError("too_large"))).toBe("too_large");
    expect(transcriptSkipReason("Gemini error 500")).toBeNull();
  });
});
