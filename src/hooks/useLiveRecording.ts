import { useEffect, useReducer } from "react";
import {
  IDLE_RECORDING,
  isRecordingActive,
  liveRecordingCopy,
  reduceLiveRecording,
} from "@/lib/recordingState";

/** How long a start/stop request may go unconfirmed by Daily before it is reported as failed. */
export const RECORDING_CONFIRM_TIMEOUT_MS = 15_000;

/**
 * The recording lifecycle of one call. Daily's `startRecording()` / `stopRecording()` return nothing, so
 * a request that Daily never answers (recording not allowed in the room, a dropped connection) would
 * leave the UI on "Starting…" forever. A request that is not confirmed within the timeout is reported as
 * failed instead of being shown as if it were happening.
 */
export function useLiveRecording(timeoutMs: number = RECORDING_CONFIRM_TIMEOUT_MS) {
  const [state, dispatch] = useReducer(reduceLiveRecording, IDLE_RECORDING);

  useEffect(() => {
    if (state.phase !== "requested" && state.phase !== "stopping") return;
    const message =
      state.phase === "requested"
        ? "The recording didn't start. Check that recording is allowed in this room, then try again."
        : "We couldn't confirm that the recording stopped. Leave the call to end it.";
    const timer = setTimeout(() => dispatch({ type: "error", message }), timeoutMs);
    return () => clearTimeout(timer);
  }, [state.phase, timeoutMs]);

  return {
    state,
    dispatch,
    /** True while a recording is actually running (recording or stopping). */
    active: isRecordingActive(state.phase),
    copy: liveRecordingCopy(state.phase),
  };
}
