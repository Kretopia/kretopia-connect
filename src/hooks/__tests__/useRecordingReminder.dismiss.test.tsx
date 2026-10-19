import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyCall } from "@daily-co/daily-js";
import { RECORDING_REMINDER_MS, SEGMENT_SAVED_NOTICE_MS, useRecordingReminder } from "../useRecordingReminder";

const api = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: api.invoke } } }));

const setup = () => {
  const call = { startRecording: vi.fn(), stopRecording: vi.fn(), leave: vi.fn() };
  const ref = { current: call as unknown as DailyCall };
  const hook = renderHook(() => useRecordingReminder(ref, "studio-room"));
  const start = (recordingId?: string) => act(() => hook.result.current.onStarted({ action: "recording-started", callClientId: "c", recordingId, instanceId: "inst-1" }));
  return { ...hook, call, start };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  api.invoke.mockReset();
  api.invoke.mockImplementation(async (_n, { body }) => ({ data: { since_ts: body.since_ts ?? null, results: [{ recording_id: "rec-1", transcript_id: "t1" }] }, error: null }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("dismissing the reminder", () => {
  it("hides it without touching the recording, and asks again one interval later", () => {
    const { result, call, start } = setup(); start("rec-1");
    act(() => vi.advanceTimersByTime(RECORDING_REMINDER_MS));
    expect(result.current.reminder).toBe(true);
    act(() => result.current.dismissReminder());
    expect(result.current.reminder).toBe(false);
    expect(result.current.state.phase).toBe("recording");
    act(() => vi.advanceTimersByTime(RECORDING_REMINDER_MS - 1));
    expect(result.current.reminder).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.reminder).toBe(true);
    expect(call.stopRecording).not.toHaveBeenCalled();
    expect(call.startRecording).not.toHaveBeenCalled();
  });

  it("a dismissal belongs to one recording: the next one is reminded on its own schedule", async () => {
    const { result, start } = setup(); start("rec-1");
    act(() => vi.advanceTimersByTime(RECORDING_REMINDER_MS));
    act(() => result.current.dismissReminder());
    act(() => result.current.stopRecording()); act(() => result.current.onStopped());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    start("rec-2");
    act(() => vi.advanceTimersByTime(RECORDING_REMINDER_MS));
    expect(result.current.reminder).toBe(true);
  });
});

describe("the segment notice", () => {
  const stopped = async (ctx: ReturnType<typeof setup>) => { ctx.start("rec-1"); act(() => ctx.result.current.stopRecording()); act(() => ctx.result.current.onStopped()); };

  it("'saved' clears itself; 'processing' cannot be dismissed", async () => {
    const ctx = setup(); await stopped(ctx);
    expect(ctx.result.current.segment).toBe("processing");
    act(() => ctx.result.current.clearSegment());
    expect(ctx.result.current.segment).toBe("processing");
    await act(async () => vi.advanceTimersByTimeAsync(45_000));
    expect(ctx.result.current.segment).toBe("saved");
    act(() => vi.advanceTimersByTime(SEGMENT_SAVED_NOTICE_MS));
    expect(ctx.result.current.segment).toBeNull();
  });

  it("'failed' stays until the user has read it", async () => {
    api.invoke.mockImplementation(async (_n, { body }) => ({ data: { since_ts: body.since_ts ?? null, results: [] }, error: null }));
    const ctx = setup(); await stopped(ctx);
    await act(async () => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(ctx.result.current.segment).toBe("failed");
    act(() => vi.advanceTimersByTime(60 * 60_000));
    expect(ctx.result.current.segment).toBe("failed");
    act(() => ctx.result.current.clearSegment());
    expect(ctx.result.current.segment).toBeNull();
  });
});

describe("how a saved segment is looked for", () => {
  it("by its recording id, sending no timestamp (the device's clock is not Daily's)", async () => {
    const ctx = setup(); ctx.start("rec-1");
    act(() => ctx.result.current.stopRecording()); act(() => ctx.result.current.onStopped());
    await act(async () => vi.advanceTimersByTimeAsync(45_000));
    expect(api.invoke).toHaveBeenCalledWith("sync-daily-recordings", { body: { room_name: "studio-room" } });
    expect(ctx.result.current.segment).toBe("saved");
  });

  it("only by time, with a margin, when Daily's event carried no recording id", async () => {
    const ctx = setup(); ctx.start(undefined);
    act(() => ctx.result.current.stopRecording()); act(() => ctx.result.current.onStopped());
    await act(async () => vi.advanceTimersByTimeAsync(45_000));
    const now = Math.floor(Date.now() / 1000);
    const body = api.invoke.mock.calls[0][1].body;
    expect(body.room_name).toBe("studio-room");
    expect(body.since_ts).toBeLessThan(now - 30); // before the moment the device heard "started"
    expect(body.since_ts).toBeGreaterThan(now - 600);
  });
});
