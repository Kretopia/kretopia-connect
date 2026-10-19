import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { type DailyCall } from "@daily-co/daily-js";
import { createDailyFrameAsync, teardownDailyCall } from "@/lib/dailyFrame";
import { supabase } from "@/integrations/supabase/client";
import { extractInvokeError } from "@/lib/extractInvokeError";
import { useRecordingReminder } from "@/hooks/useRecordingReminder";
import type { LiveRecordingPhase } from "@/lib/recordingState";
import { readSyncOutcome, scheduleRecordingSync } from "@/lib/recordingSync";
import type { VideoCallSheetProps } from "@/components/project/VideoCallSheet";

/**
 * VideoCallContext — CEO hotfix (24/09/2026): "/meet/:meetingId" (CallPage.tsx)
 * used to own the Daily call object and its DOM container directly inside the
 * route component. Navigating away unmounted CallPage, whose cleanup effect
 * tore the call down completely (teardownDailyCall) -- the call didn't just
 * stop being visible, it actually ended.
 *
 * This lifts that same state up to a provider mounted once at the app shell
 * level (outside <Routes>, in App.tsx), so it survives route changes.
 * GlobalVideoCallHost.tsx owns the one persistent DOM container the Daily
 * iframe attaches to and repositions it (full-screen when the current route
 * matches the active meeting, a small fixed corner box otherwise) -- the
 * iframe itself is never destroyed or remounted by navigation, only resized.
 *
 * Scoped to CallPage's /meet/:meetingId flow only. VideoCallSheet.tsx
 * (project quick calls) and SoundStageRoom.tsx (Circle stages) each create
 * their own independent Daily frame today and are unaffected by this --
 * Daily only allows one live frame globally anyway, so starting a call in
 * either of those while a /meet call is floating would already tear the
 * /meet call down under the pre-existing singleton rule in dailyFrame.ts,
 * same as before this change.
 */

export type VideoCallPhase = "idle" | "loading" | "lobby" | "live" | "ended" | "error";

export interface JoinPrefs {
  mic: boolean;
  cam: boolean;
  micDeviceId?: string;
  camDeviceId?: string;
  speakerDeviceId?: string;
}

interface TokenInfo {
  token: string;
  roomUrl: string;
}

interface VideoCallContextValue {
  studioCall: VideoCallSheetProps | null;
  openStudioCall: (props: VideoCallSheetProps) => void;
  closeStudioCall: () => void;
  meetingId: string | null;
  shareToken: string | undefined;
  phase: VideoCallPhase;
  error: string | null;
  title: string;
  /** True while a recording is actually running (recording or stopping). */
  recording: boolean;
  /** Where the recording is in its lifecycle: requested, recording, stopping, processing, saved or failed. */
  recordingPhase: LiveRecordingPhase;
  /** When the running recording started (ms epoch), null when none is running. */
  recordingStartedAt: number | null;
  recordingError: string | null;
  sharing: boolean;
  role: string | null;
  isHost: boolean;
  guestName: string;
  setGuestName: (name: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  callRef: React.RefObject<DailyCall | null>;
  /** Fetches a meeting token and moves to the lobby. No-ops (just re-syncs
   *  phase) if this meetingId is already active so returning to /meet/:id
   *  while the call is live doesn't re-run the lobby or re-mint a token. */
  openMeeting: (meetingId: string, shareToken: string | undefined, userName: string | undefined) => Promise<void>;
  joinLive: (prefs: JoinPrefs, userName: string) => void;
  leave: () => Promise<void>;
  /** Fully resets to idle -- only once the user is done with the call
   *  entirely (e.g. "Done" on the ended screen), not on route navigation. */
  reset: () => void;
  toggleRecord: () => Promise<void>;
  recordingReminder: boolean;
  recordingSegment: "processing" | "saved" | "failed" | null;
  stopRecording: () => void;
  saveRecording: () => void;
  toggleShare: () => Promise<void>;
  toggleMic: () => Promise<void>;
  micOn: boolean;
}

const VideoCallContext = createContext<VideoCallContextValue | undefined>(undefined);

export function VideoCallProvider({ children }: { children: ReactNode }) {
  const [studioCall, setStudioCall] = useState<VideoCallSheetProps | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const joinPrefsRef = useRef<JoinPrefs>({ mic: false, cam: false });
  const userNameRef = useRef<string>("Guest");

  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<VideoCallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Joining call");
  const didRecordRef = useRef(false);
  const callStartedAtRef = useRef<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const recordingControls = useRecordingReminder(callRef, tokenInfo?.roomUrl.split("/").pop());
  const { state: live, dispatch: dispatchRecording, active: recording } = recordingControls;
  const recordingControlsRef = useRef(recordingControls);
  recordingControlsRef.current = recordingControls;
  const [micOn, setMicOn] = useState(false);

  const openMeeting = useCallback(
    async (nextMeetingId: string, nextShareToken: string | undefined, userName: string | undefined) => {
      if (studioCall || (phase === "live" && meetingId !== nextMeetingId)) return;
      // Already the active meeting (e.g. navigated back to /meet/:id while
      // live/lobby) -- don't re-fetch a token or reset progress.
      if (meetingId === nextMeetingId && phase !== "idle" && phase !== "ended" && phase !== "error") {
        return;
      }
      setMeetingId(nextMeetingId);
      setShareToken(nextShareToken);
      setPhase("loading");
      setError(null);
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("mint-meeting-token", {
          body: { meeting_id: nextMeetingId, share_token: nextShareToken, user_name: userName || undefined },
        });
        if (invokeErr || !data?.token) {
          setError(data?.error || (await extractInvokeError(invokeErr)) || "Couldn't load meeting");
          setPhase("error");
          return;
        }
        setTokenInfo({ token: data.token, roomUrl: data.room_url });
        setTitle(data.title || "Meeting");
        setRole(data.role || null);
        setPhase("lobby");
      } catch (e: any) {
        setError((await extractInvokeError(e)) || e?.message || "Couldn't load meeting");
        setPhase("error");
      }
    },
    [meetingId, phase, studioCall],
  );

  const joinLive = useCallback((prefs: JoinPrefs, userName: string) => {
    joinPrefsRef.current = prefs;
    userNameRef.current = userName;
    setMicOn(prefs.mic);
    setPhase("live");
  }, []);

  // Daily frame lifecycle -- runs once per "live" entry for a given
  // tokenInfo, attached to the ONE persistent container GlobalVideoCallHost
  // renders (never unmounted by route changes, so this effect's cleanup only
  // fires on a genuine new meeting / provider unmount, not on navigation).
  const startFrame = useCallback(async () => {
    if (!tokenInfo || !containerRef.current) return;
    const container = containerRef.current;
    let frame: DailyCall | null = null;
    try {
      frame = await createDailyFrameAsync(container, {
        iframeStyle: { width: "100%", height: "100%", border: "0" },
        showLeaveButton: false,
        showFullscreenButton: false,
      });
    } catch (err: any) {
      console.error("[VideoCallContext] createFrame failed", err);
      setError(err?.message || "Couldn't start the call");
      setPhase("error");
      return;
    }
    callRef.current = frame;
    const prefs = joinPrefsRef.current;
    // Listeners go on before join so an event fired while joining is not lost.
    frame.on("left-meeting", () => {
      setPhase("ended");
      // A cloud recording is finalised some time after the call ends (longer calls take longer). Look
      // for it for ~10 minutes and stop once it is stored; Recordings is the only place it appears.
      if (didRecordRef.current) {
        didRecordRef.current = false;
        const since = callStartedAtRef.current ? Math.floor(callStartedAtRef.current / 1000) : undefined;
        scheduleRecordingSync({
          roomName: tokenInfo.roomUrl.split("/").pop() || undefined,
          sinceTs: since,
          run: async ({ roomName, sinceTs }) => {
            const { data, error: syncErr } = await supabase.functions.invoke("sync-daily-recordings", {
              body: { room_name: roomName, since_ts: sinceTs },
            });
            if (syncErr) throw syncErr;
            return readSyncOutcome(data, sinceTs);
          },
        });
      }
    });
    frame.on("recording-started", (ev) => {
      didRecordRef.current = true;
      recordingControlsRef.current.onStarted(ev);
    });
    frame.on("recording-stopped", () => recordingControlsRef.current.onStopped());
    frame.on("recording-error", (ev: { errorMsg?: string; error?: string } | undefined) =>
      dispatchRecording({ type: "error", message: ev?.errorMsg ?? ev?.error ?? null }),
    );
    frame.on("local-screen-share-started", () => setSharing(true));
    frame.on("local-screen-share-stopped", () => setSharing(false));
    try {
      await frame.join({
        url: tokenInfo.roomUrl,
        token: tokenInfo.token,
        userName: userNameRef.current,
        startVideoOff: !prefs.cam,
        startAudioOff: !prefs.mic,
      });
      callStartedAtRef.current = Date.now();
      if (prefs.micDeviceId || prefs.camDeviceId || prefs.speakerDeviceId) {
        try {
          await (frame as any).setInputDevicesAsync?.({
            audioDeviceId: prefs.micDeviceId,
            videoDeviceId: prefs.camDeviceId,
          });
          if (prefs.speakerDeviceId) {
            await (frame as any).setOutputDeviceAsync?.({ outputDeviceId: prefs.speakerDeviceId });
          }
        } catch (e) {
          console.warn("[VideoCallContext] device apply", e);
        }
      }
    } catch (err: any) {
      console.error("[VideoCallContext] join failed", err);
      setError(err?.message || "Failed to join");
      setPhase("error");
      return;
    }
  }, [tokenInfo, dispatchRecording]);

  // Starts the frame once phase reaches "live" AND the persistent container
  // has actually been committed to the DOM (containerRef.current is only
  // populated after commit, i.e. inside an effect -- calling this directly
  // in the render body, as an earlier version of this file did, always saw
  // a null containerRef and silently no-op'd: "live" rendered the full call
  // chrome with nothing behind it, no iframe ever attached. Guarded by a
  // ref (not state) so it fires exactly once per new tokenInfo, not on
  // every unrelated re-render while the call is already live.
  const startedForTokenRef = useRef<TokenInfo | null>(null);
  useEffect(() => {
    if (phase !== "live" || !tokenInfo) return;
    if (startedForTokenRef.current === tokenInfo) return;
    startedForTokenRef.current = tokenInfo;
    void startFrame();
  }, [phase, tokenInfo, startFrame]);

  const leave = useCallback(async () => {
    try {
      await callRef.current?.leave();
    } catch {
      /* already left */
    }
    setPhase("ended");
  }, []);

  const reset = useCallback(() => {
    const frame = callRef.current;
    callRef.current = null;
    startedForTokenRef.current = null;
    void teardownDailyCall(frame);
    setMeetingId(null);
    setShareToken(undefined);
    setPhase("idle");
    setError(null);
    setTitle("Joining call");
    dispatchRecording({ type: "reset" });
    didRecordRef.current = false;
    callStartedAtRef.current = null;
    setSharing(false);
    setRole(null);
    setGuestName("");
    setTokenInfo(null);
    setMicOn(false);
  }, []);

  const toggleRecord = useCallback(async () => {
    if (live.phase === "recording") { recordingControlsRef.current.stopRecording(); return; }
    if (["requested", "stopping", "processing"].includes(live.phase)) return;
    const stopping = recording;
    try {
      dispatchRecording({ type: stopping ? "stop-requested" : "start-requested" });
      if (stopping) await callRef.current?.stopRecording();
      else await callRef.current?.startRecording();
    } catch (e) {
      dispatchRecording({ type: "error", message: e instanceof Error ? e.message : null });
      /* surfaced via toast at the call site */
      throw new Error("Recording unavailable");
    }
  }, [recording, live.phase, dispatchRecording]);

  const toggleShare = useCallback(async () => {
    try {
      if (sharing) await callRef.current?.stopScreenShare();
      else await callRef.current?.startScreenShare();
    } catch {
      throw new Error("Couldn't share");
    }
  }, [sharing]);

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    try {
      await callRef.current?.setLocalAudio(next);
      setMicOn(next);
    } catch {
      /* leave micOn as-is on failure */
    }
  }, [micOn]);

  const value: VideoCallContextValue = {
    studioCall,
    openStudioCall: useCallback((props: VideoCallSheetProps) => {
      if (phase === "live") return;
      setStudioCall(current => current ?? { ...props, open: true });
    }, [phase]),
    closeStudioCall: useCallback(() => setStudioCall(null), []),
    meetingId,
    shareToken,
    phase,
    error,
    title,
    recording,
    recordingPhase: live.phase,
    recordingStartedAt: live.startedAt,
    recordingError: live.error,
    recordingReminder: recordingControls.reminder,
    recordingSegment: recordingControls.segment,
    stopRecording: recordingControls.stopRecording,
    saveRecording: recordingControls.saveRecording,
    sharing,
    role,
    isHost: role === "host",
    guestName,
    setGuestName,
    containerRef,
    callRef,
    openMeeting,
    joinLive,
    leave,
    reset,
    toggleRecord,
    toggleShare,
    toggleMic,
    micOn,
  };

  return <VideoCallContext.Provider value={value}>{children}</VideoCallContext.Provider>;
}

export function useVideoCall(): VideoCallContextValue {
  const ctx = useContext(VideoCallContext);
  if (!ctx) throw new Error("useVideoCall must be used within a VideoCallProvider");
  return ctx;
}
