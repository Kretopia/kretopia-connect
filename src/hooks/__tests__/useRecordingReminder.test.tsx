import { act, render, renderHook, fireEvent, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyCall } from "@daily-co/daily-js";
import { useRecordingReminder, RECORDING_REMINDER_MS } from "../useRecordingReminder";
import { RecordingReminder } from "@/components/calls/RecordingReminder";
import { RECORDING_CONFIRM_TIMEOUT_MS } from "../useLiveRecording";

const api = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: api.invoke } } }));
const daily = () => ({ startRecording: vi.fn(), stopRecording: vi.fn(), leave: vi.fn(), setLocalAudio: vi.fn(), setLocalVideo: vi.fn() });
const setup = () => {
  const call = daily();
  const ref = { current: call as unknown as DailyCall };
  const hook = renderHook(() => useRecordingReminder(ref, "studio-room"));
  const start = () => act(() => hook.result.current.onStarted({ action: "recording-started", callClientId: "test-call", recordingId: "rec-1", instanceId: "instance-1" }));
  return { ...hook, call, ref, start };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-19T03:25:00Z"));
  api.invoke.mockReset();
  api.invoke.mockImplementation(async (_name, { body }) => ({ data: { since_ts: body.since_ts, results: [{ recording_id: "rec-1", transcript_id: "transcript-1" }] }, error: null }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Studio recording reminder", () => {
  it("appears only after 15 minutes of confirmed recording, with no automatic stop/save", () => {
    const { result, call, start } = setup();
    act(() => vi.advanceTimersByTime(RECORDING_REMINDER_MS));
    expect(result.current.reminder).toBe(false);
    start();
    act(() => vi.advanceTimersByTime(RECORDING_REMINDER_MS - 1));
    expect(result.current.reminder).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.reminder).toBe(true);
    act(() => vi.advanceTimersByTime(RECORDING_REMINDER_MS * 3));
    expect(call.startRecording).not.toHaveBeenCalled();
    expect(call.stopRecording).not.toHaveBeenCalled();
    expect(api.invoke).not.toHaveBeenCalled();
  });
  it("Stop ends the recording, confirms saving via existing sync and does not end the call", async () => {
    const { result, call, start } = setup(); start();
    act(() => result.current.stopRecording());
    expect(call.stopRecording).toHaveBeenCalledExactlyOnceWith({ instanceId: "instance-1" });
    expect(result.current.state.phase).toBe("stopping");
    act(() => result.current.onStopped());
    expect(result.current.state.phase).toBe("processing");
    expect(result.current.segment).toBe("processing");
    await act(async () => vi.advanceTimersByTimeAsync(45_000));
    expect(result.current.segment).toBe("saved");
    expect(result.current.state.phase).toBe("saved");
    expect(call.startRecording).not.toHaveBeenCalled();
    expect(call.leave).not.toHaveBeenCalled();
    expect(call.setLocalAudio).not.toHaveBeenCalled();
    expect(call.setLocalVideo).not.toHaveBeenCalled();
  });
  it("Save waits for stop confirmation then starts one new segment while the call continues", async () => {
    const { result, call, start } = setup(); start();
    act(() => result.current.saveRecording());
    expect(call.stopRecording).toHaveBeenCalledTimes(1);
    expect(call.startRecording).not.toHaveBeenCalled();
    act(() => result.current.onStopped());
    expect(call.startRecording).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe("requested");
    act(() => result.current.onStarted({ action: "recording-started", callClientId: "test-call", recordingId: "rec-2" }));
    await act(async () => vi.advanceTimersByTimeAsync(45_000));
    expect(result.current.segment).toBe("saved");
    expect(result.current.state.phase).toBe("recording");
    expect(result.current.active).toBe(true);
    expect(call.leave).not.toHaveBeenCalled();
    expect(call.setLocalAudio).not.toHaveBeenCalled();
    expect(call.setLocalVideo).not.toHaveBeenCalled();
  });
  it("double clicks and duplicate stop/start events do not duplicate segment commands or timers", () => {
    const { result, call, start } = setup(); start();
    const firstStarted = result.current.state.startedAt;
    act(() => vi.advanceTimersByTime(1000)); start();
    expect(result.current.state.startedAt).toBe(firstStarted);
    act(() => { result.current.saveRecording(); result.current.saveRecording(); result.current.stopRecording(); });
    expect(call.stopRecording).toHaveBeenCalledTimes(1);
    act(() => { result.current.onStopped(); result.current.onStopped(); });
    expect(call.startRecording).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe("requested");
  });
  it("a stop initiated elsewhere does not automatically start a segment", () => {
    const { result, call, start } = setup(); start();
    act(() => result.current.onStopped());
    expect(result.current.reminder).toBe(false);
    expect(call.startRecording).not.toHaveBeenCalled();
    expect(api.invoke).not.toHaveBeenCalled();
  });
  it("an unconfirmed Save stop fails without starting a new recording, even after a late event", () => {
    const { result, call, start } = setup(); start();
    act(() => result.current.saveRecording());
    act(() => vi.advanceTimersByTime(RECORDING_CONFIRM_TIMEOUT_MS + 1));
    expect(result.current.state.phase).toBe("failed");
    act(() => result.current.onStopped());
    expect(call.startRecording).not.toHaveBeenCalled();
  });
  it("does not claim saved from a different recording or while the exact segment is processing", async () => {
    const { result, start } = setup(); start();
    api.invoke.mockImplementation(async (_name, { body }) => ({ data: { since_ts: body.since_ts, results: [{ recording_id: "old", transcript_id: "old-t" }, { recording_id: "rec-1", skipped: "status=processing" }] }, error: null }));
    act(() => result.current.stopRecording()); act(() => result.current.onStopped());
    await act(async () => vi.advanceTimersByTimeAsync(45_000));
    expect(result.current.segment).toBe("processing");
    expect(result.current.state.phase).toBe("processing");
  });
  it("keeps a failed restart distinct from a saved previous segment", async () => {
    const { result, call, start } = setup(); start();
    call.startRecording.mockImplementation(() => { throw new Error("Daily rejected start"); });
    act(() => result.current.saveRecording()); act(() => result.current.onStopped());
    expect(result.current.state.phase).toBe("failed");
    await act(async () => vi.advanceTimersByTimeAsync(45_000));
    expect(result.current.segment).toBe("saved");
    expect(result.current.state.phase).toBe("failed");
  });
  it("reports an unconfirmed segment after the existing sync window, without automatic retry commands", async () => {
    const { result, call, start } = setup(); start();
    api.invoke.mockImplementation(async (_name, { body }) => ({ data: { since_ts: body.since_ts, results: [] }, error: null }));
    act(() => result.current.stopRecording()); act(() => result.current.onStopped());
    await act(async () => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(result.current.segment).toBe("failed");
    expect(call.stopRecording).toHaveBeenCalledTimes(1);
    expect(call.startRecording).not.toHaveBeenCalled();
  });
  it("reminder buttons require explicit clicks and call the correct action", () => {
    const stop = vi.fn(), save = vi.fn();
    render(<RecordingReminder visible segment={null} onStop={stop} onSave={save} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(stop).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    expect(stop).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save recording" }));
    expect(save).toHaveBeenCalledTimes(1);
  });
});
