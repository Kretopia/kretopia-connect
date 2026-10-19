import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECORDING_CONFIRM_TIMEOUT_MS, useLiveRecording } from "../useLiveRecording";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useLiveRecording", () => {
  it("a start request that Daily never confirms becomes a visible failure, not an endless 'Starting…'", () => {
    const { result } = renderHook(() => useLiveRecording());
    act(() => result.current.dispatch({ type: "start-requested" }));
    expect(result.current.state.phase).toBe("requested");
    expect(result.current.copy?.label).toBe("Starting recording…");
    act(() => void vi.advanceTimersByTime(RECORDING_CONFIRM_TIMEOUT_MS + 1));
    expect(result.current.state.phase).toBe("failed");
    expect(result.current.state.error).toMatch(/didn't start/);
  });

  it("a confirmed start cancels the timeout", () => {
    const { result } = renderHook(() => useLiveRecording());
    act(() => result.current.dispatch({ type: "start-requested" }));
    act(() => result.current.dispatch({ type: "started" }));
    act(() => void vi.advanceTimersByTime(RECORDING_CONFIRM_TIMEOUT_MS * 2));
    expect(result.current.state.phase).toBe("recording");
    expect(result.current.active).toBe(true);
  });

  it("a stop that is never confirmed says so instead of pretending it stopped", () => {
    const { result } = renderHook(() => useLiveRecording());
    act(() => result.current.dispatch({ type: "started" }));
    act(() => result.current.dispatch({ type: "stop-requested" }));
    act(() => void vi.advanceTimersByTime(RECORDING_CONFIRM_TIMEOUT_MS + 1));
    expect(result.current.state.phase).toBe("failed");
    expect(result.current.state.error).toMatch(/couldn't confirm/);
  });
});
