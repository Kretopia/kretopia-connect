import { useEffect, useRef, useState, type RefObject } from "react";
import type { DailyCall, DailyEventObjectRecordingStarted } from "@daily-co/daily-js";
import { supabase } from "@/integrations/supabase/client";
import { useLiveRecording } from "@/hooks/useLiveRecording";
import { POST_CALL_SYNC_DELAYS_MS, readSyncOutcome, scheduleRecordingSync } from "@/lib/recordingSync";

export const RECORDING_REMINDER_MS = 15 * 60_000;
type SegmentState = "processing" | "saved" | "failed" | null;

/** Explicit segment controls around the existing, event-driven live recording state. */
export function useRecordingReminder(callRef: RefObject<DailyCall | null>, roomName?: string) {
  const live = useLiveRecording();
  const [reminder, setReminder] = useState(false);
  const [segment, setSegment] = useState<SegmentState>(null);
  const latest = useRef(live.state);
  latest.current = live.state;
  const intent = useRef<"stop" | "save" | null>(null);
  const segmentRef = useRef<{ id?: string; instanceId?: string; since?: number }>({});
  const cancelSync = useRef<(() => void) | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    setReminder(false);
    if (live.state.phase !== "recording" || live.state.startedAt === null) return;
    const timer = setTimeout(() => setReminder(true), Math.max(0, live.state.startedAt + RECORDING_REMINDER_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [live.state.phase, live.state.startedAt]);
  useEffect(() => {
    if (live.state.phase === "failed") intent.current = null;
    if (live.state.phase === "idle") {
      intent.current = null;
      generation.current += 1;
      cancelSync.current?.();
      setSegment(null);
    }
  }, [live.state.phase]);
  useEffect(() => () => cancelSync.current?.(), []);

  const onStarted = (event?: DailyEventObjectRecordingStarted) => {
    if (latest.current.phase !== "recording" && latest.current.phase !== "stopping") {
      segmentRef.current = { id: event?.recordingId, instanceId: event?.instanceId, since: Math.floor(Date.now() / 1000) };
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
          const { data, error } = await supabase.functions.invoke("sync-daily-recordings", {
            body: { room_name: room, since_ts: sinceTs },
          });
          if (error) throw error;
          // Neither an older segment nor the new running segment proves this checkpoint saved.
          const results = Array.isArray(data?.results) ? data.results : [];
          const scoped = finished.id ? results.filter((r: { recording_id?: string }) => r.recording_id === finished.id) : [];
          const outcome = readSyncOutcome({ since_ts: data?.since_ts, results: scoped }, sinceTs);
          if (!outcome.stored && Date.now() >= stoppedAt + POST_CALL_SYNC_DELAYS_MS[3] && generation.current === currentGeneration) setSegment("failed");
          return outcome;
        } catch (error) {
          if (Date.now() >= stoppedAt + POST_CALL_SYNC_DELAYS_MS[3] && generation.current === currentGeneration) setSegment("failed");
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
  return { ...live, reminder, segment, onStarted, onStopped,
    stopRecording: () => finish("stop"), saveRecording: () => finish("save") };
}
