import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST_CALL_SYNC_DELAYS_MS, readSyncOutcome, scheduleRecordingSync } from "../recordingSync";

describe("scheduleRecordingSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("looks for about ten minutes with a widening gap, then gives up", async () => {
    const run = vi.fn(async () => ({ stored: false }));
    scheduleRecordingSync({ roomName: "r1", run });
    expect(run).not.toHaveBeenCalled();
    for (const [i, at] of POST_CALL_SYNC_DELAYS_MS.entries()) {
      await vi.advanceTimersByTimeAsync(i === 0 ? at : at - POST_CALL_SYNC_DELAYS_MS[i - 1]);
      expect(run).toHaveBeenCalledTimes(i + 1);
    }
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(run).toHaveBeenCalledTimes(POST_CALL_SYNC_DELAYS_MS.length);
  });

  it("stops as soon as the recording is stored and says so once", async () => {
    const run = vi.fn().mockResolvedValueOnce({ stored: false }).mockResolvedValueOnce({ stored: true });
    const onStored = vi.fn();
    scheduleRecordingSync({ roomName: "r2", run, onStored });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(onStored).toHaveBeenCalledTimes(1);
  });

  it("a failing run is logged and the schedule carries on", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ stored: true });
    const onStored = vi.fn();
    scheduleRecordingSync({ roomName: "r3", run, onStored });
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(onStored).toHaveBeenCalledTimes(1);
  });

  it("a second schedule for the same room replaces the first instead of doubling the polls", async () => {
    const first = vi.fn(async () => ({ stored: false }));
    const second = vi.fn(async () => ({ stored: false }));
    scheduleRecordingSync({ roomName: "r4", run: first });
    scheduleRecordingSync({ roomName: "r4", run: second });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("can be cancelled", async () => {
    const run = vi.fn(async () => ({ stored: false }));
    const cancel = scheduleRecordingSync({ roomName: "r5", run });
    cancel();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("readSyncOutcome: only an answer about THIS call counts", () => {
  const SINCE = 1_760_000_000;
  it("stored when this call's recording is stored and nothing in the room is still processing", () => {
    expect(readSyncOutcome({ since_ts: SINCE, results: [{ transcript_id: "t1" }] }, SINCE)).toEqual({ stored: true });
  });
  it("not stored while Daily is still finalising, or when nothing was found yet", () => {
    expect(readSyncOutcome({ since_ts: SINCE, results: [{ transcript_id: "t1" }, { skipped: "status=processing" }] }, SINCE).stored).toBe(false);
    expect(readSyncOutcome({ since_ts: SINCE, results: [] }, SINCE).stored).toBe(false);
    expect(readSyncOutcome({ since_ts: SINCE, results: [{ error: "insert failed" }] }, SINCE).stored).toBe(false);
  });
  it("an older deployment that does not echo since_ts says nothing about this call", () => {
    expect(readSyncOutcome({ results: [{ transcript_id: "t-from-last-week" }] }, SINCE).stored).toBe(false);
    expect(readSyncOutcome({ since_ts: 123, results: [{ transcript_id: "t1" }] }, SINCE).stored).toBe(false);
    expect(readSyncOutcome(null, SINCE).stored).toBe(false);
    expect(readSyncOutcome({ since_ts: SINCE, results: [{ transcript_id: "t1" }] }, undefined).stored).toBe(false);
  });
});
