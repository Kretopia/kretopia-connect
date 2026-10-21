import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { DailyCall, DailyEventObjectRecordingStarted } from "@daily-co/daily-js";
import { supabase } from "@/integrations/supabase/client";
import { useLiveRecording } from "@/hooks/useLiveRecording";
import {
  POST_CALL_SYNC_GIVE_UP_MS,
  readSegmentOutcome,
  readSyncOutcome,
  scheduleRecordingSync,
} from "@/lib/recordingSync";

export const RECORDING_REMINDER_MS = 15 * 60_000;
/** How long "Segment saved" stays on screen before it clears itself. */
export const SEGMENT_SAVED_NOTICE_MS = 8_000;
/** Without a recording id the segment can only be found by time; this absorbs latency and a slow device clock. */
const UNKNOWN_ID_SINCE_MARGIN_S = 60;
type SegmentState = "processing" | "saved" | "failed" | null;

/** Explicit segment controls around the existing, event-driven live recording state. */
export function useRecordingReminder(callRef: RefObject<DailyCall | null>, roomName?: string) {
  const live = useLiveRecording();
  const [reminder, setReminder] = useState(false);
  const [segment, setSegment] = useState<SegmentState>(null);
  // "Not now": the reminder comes back one full interval after the dismissal, for this recording only.
  const [snooze, setSnooze] = useState<{ startedAt: number; until: number } | null>(null);
  const latest = useRef(live.state);
  latest.current = live.state;
  const intent = useRef<"stop" | "save" | null>(null);
  const segmentRef = useRef<{ id?: string; instanceId?: string; since?: number }>({});
  const cancelSync = useRef<(() => void) | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    setReminder(false);
    if (live.state.phase !== "recording" || live.state.startedAt === null) return;
    const due = snooze && snooze.startedAt === live.state.startedAt ? snooze.until : live.state.startedAt + RECORDING_REMINDER_MS;
    const timer = setTimeout(() => setReminder(true), Math.max(0, due - Date.now()));
    return () => clearTimeout(timer);
  }, [live.state.phase, live.state.startedAt, snooze]);
  useEffect(() => {
    if (live.state.phase === "failed") intent.current = null;
    if (live.state.phase === "idle") {
      intent.current = null;
      generation.current += 1;
      cancelSync.current?.();
      setSegment(null);
      setSnooze(null);
    }
  }, [live.state.phase]);
  useEffect(() => () => cancelSync.current?.(), []);
  // "Segment saved" is news, not state: it clears itself.
  useEffect(() => {
    if (segment !== "saved") return;
    const timer = setTimeout(() => setSegment((current) => (current === "saved" ? null : current)), SEGMENT_SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [segment]);

  const onStarted = (event?: DailyEventObjectRecordingStarted) => {
    if (latest.current.phase !== "recording" && latest.current.phase !== "stopping") {
      segmentRef.current = {
        id: event?.recordingId,
        instanceId: event?.instanceId,
        since: Math.floor(Date.now() / 1000) - UNKNOWN_ID_SINCE_MARGIN_S,
      };
    }
    live.dispatch({ type: "started" });
  };

  const onStopped = () => {
    const action = intent.current;
    intent.current = null;
    live.dispatch({ type: "stopped" });
    if (!action) return;
    const finished = segmentRef.current;
    const stoppedAt = Date.now();
    const currentGeneration = ++generation.current;
    setSegment("processing");
    cancelSync.current = scheduleRecordingSync({
      roomName,
      sinceTs: finished.since,
      run: async ({ roomName: room, sinceTs }) => {
        try {
          // With the recording's id the answer is matched by id and no timestamp is sent (the device's clock
          // is not Daily's); without one, only a time window can find it.
          const { data, error } = await supabase.functions.invoke("sync-daily-recordings", {
            body: finished.id ? { room_name: room } : { room_name: room, since_ts: sinceTs },
          });
          if (error) throw error;
          const outcome = finished.id ? readSegmentOutcome(data, finished.id) : readSyncOutcome(data, sinceTs);
          if (!outcome.stored && Date.now() >= stoppedAt + POST_CALL_SYNC_GIVE_UP_MS && generation.current === currentGeneration) setSegment("failed");
          return outcome;
        } catch (error) {
          if (Date.now() >= stoppedAt + POST_CALL_SYNC_GIVE_UP_MS && generation.current === currentGeneration) setSegment("failed");
          throw error;
        }
      },
      onStored: () => {
        if (generation.current !== currentGeneration) return;
        setSegment("saved");
        if (latest.current.phase === "processing") live.dispatch({ type: "saved" });
      },
    });
    if (action === "save") {
      const call = callRef.current;
      if (!call) {
        live.dispatch({ type: "error", message: "The segment is saving, but the next recording could not start." });
        return;
      }
      live.dispatch({ type: "start-requested" });
      try { call.startRecording(finished.instanceId ? { instanceId: finished.instanceId } : undefined); }
      catch (error) { live.dispatch({ type: "error", message: error instanceof Error ? error.message : null }); }
    }
  };

  const finish = (action: "stop" | "save") => {
    const call = callRef.current;
    if (!call || latest.current.phase !== "recording" || intent.current) return;
    intent.current = action;
    setReminder(false);
    live.dispatch({ type: "stop-requested" });
    try {
      const instanceId = segmentRef.current.instanceId;
      call.stopRecording(instanceId ? { instanceId } : undefined);
    } catch (error) {
      intent.current = null;
      live.dispatch({ type: "error", message: error instanceof Error ? error.message : null });
    }
  };

  /** Hides the reminder without touching the recording, and asks again one interval later. */
  const dismissReminder = useCallback(() => {
    const startedAt = latest.current.startedAt;
    setReminder(false);
    if (startedAt !== null) setSnooze({ startedAt, until: Date.now() + RECORDING_REMINDER_MS });
  }, []);
  /** Clears a segment notice the user has read (a failure stays until they do). */
  const clearSegment = useCallback(() => setSegment((current) => (current === "processing" ? current : null)), []);

  return { ...live, reminder, segment, onStarted, onStopped, dismissReminder, clearSegment,
    stopRecording: () => finish("stop"), saveRecording: () => finish("save") };
}
