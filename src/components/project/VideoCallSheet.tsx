import { CallBrand, CallMediaControls } from "@/components/calls/CallMediaControls";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { PersistentCallWindow, ConfirmCallLeave } from "@/components/calls/PersistentCallWindow";
import { toast as sonnerToast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  PhoneOff,
  UserPlus,
  Circle,
  MoreVertical,
  Flag,
  Ban,
  MicOff,
} from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportBlockDialog } from "@/components/user/ReportBlockDialog";
import { type DailyCall } from "@daily-co/daily-js";
import { createDailyFrameAsync, destroyExistingDailyFrameAsync } from "@/lib/dailyFrame";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PreCallLobby } from "./PreCallLobby";
import { CallInviteSheet } from "./CallInviteSheet";
import { CallPreflightGate } from "@/components/calls/CallPreflightGate";
import { useRecordingReminder } from "@/hooks/useRecordingReminder";
import { RecordingReminder } from "@/components/calls/RecordingReminder";
import { readSyncOutcome, scheduleRecordingSync } from "@/lib/recordingSync";

export interface VideoCallSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  roomUrl: string | null;
  token: string | null;
  callId: string | null;
  userName: string;
  /** Optional avatar for the ringer payload. */
  userAvatar?: string | null;
  projectId?: string | null;
  directCallId?: string | null;
  roomName?: string | null;
  /** CTA shown in the pre-call lobby. Defaults to "Start call" (host flow). */
  lobbyCta?: string;
  /** Pre-baked share URL for ad-hoc meetings (shown as Copy Link in lobby + invite). */
  meetingShareUrl?: string | null;
  /** When set, enables 1-tap in-call Report / Block on the other person. */
  peerUserId?: string | null;
  peerName?: string | null;
  /** Optional: called after a successful block so callers can end the call / re-pair. */
  onPeerBlocked?: () => void;
  /** Optional React node rendered as a floating bar over the video (top center) — used for Speed Session connect / save-for-later CTAs. */
  overlayActions?: React.ReactNode;
  /** When true, expose host-only controls (Mute all). */
  isHost?: boolean;
  /** When true, automatically start Daily cloud recording on join (recording must be enabled on the room). */
  autoStartRecording?: boolean;
  /** When true, render a "Backstage" badge in the header instead of "Live call". */
  backstage?: boolean;
}

type Phase = "lobby" | "live";

let nextOwner = 0;

/**
 * What every caller renders. The call itself lives in the app shell (PersistentStudioCall) so that it survives
 * navigation, which means this component only hands it over and keeps it in step:
 *  - open with a room: start the call for this caller; a second call is refused (and the user told);
 *  - props change while open (overlay actions, flags, a new room): the live call follows;
 *  - `open` becomes false while this caller is still mounted: the call ends, as it did when the sheet itself closed;
 *  - the caller unmounting (navigating away) does NOT end it.
 */
export function VideoCallSheet(props: VideoCallSheetProps) {
  const { openStudioCall, updateStudioCall, closeStudioCall } = useVideoCall();
  const owner = useRef<string>();
  owner.current ??= `studio-call-${++nextOwner}`;
  const callback = useRef(props.onOpenChange);
  callback.current = props.onOpenChange;
  const forward = useRef((value: boolean) => callback.current(value)).current;
  const started = useRef(false);
  const active = props.open && !!props.roomUrl;

  useEffect(() => {
    if (!active) return;
    const config = { ...props, onOpenChange: forward };
    if (started.current) updateStudioCall(config, owner.current);
    else started.current = openStudioCall(config, owner.current);
    // One effect for every prop the live call renders or reads; `props` itself is a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, props.projectName, props.roomUrl, props.token, props.callId, props.userName, props.userAvatar, props.projectId, props.directCallId,
    props.roomName, props.lobbyCta, props.meetingShareUrl, props.peerUserId, props.peerName, props.onPeerBlocked, props.overlayActions,
    props.isHost, props.autoStartRecording, props.backstage, forward, openStudioCall, updateStudioCall]);

  useEffect(() => {
    if (active || !started.current) return;
    started.current = false;
    closeStudioCall(owner.current);
  }, [active, closeStudioCall]);
  return null;
}

export const PersistentStudioCall = ({
  open,
  onOpenChange,
  projectName,
  roomUrl,
  token,
  callId,
  userName,
  userAvatar,
  projectId,
  directCallId,
  roomName,
  lobbyCta = "Start call",
  meetingShareUrl = null,
  peerUserId = null,
  peerName = null,
  onPeerBlocked,
  overlayActions,
  isHost = false,
  autoStartRecording = false,
  backstage = false,
}: VideoCallSheetProps) => {
  const { toast } = useToast();
  const routeNavigate = useNavigate();
  const navigateRef = useRef(routeNavigate);
  navigateRef.current = routeNavigate;
  const navigate = useRef((path: string) => navigateRef.current(path)).current;
  const location = useLocation();
  const originRoute = useRef(location.pathname).current;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callRef = useRef<DailyCall | null>(null);
  const [mediaCall, setMediaCall] = useState<DailyCall | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const didRecordRef = useRef<boolean>(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [joining, setJoining] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting");
  // Recording lifecycle (requested, recording, stopping, processing, failed), driven by Daily's events.
  const recordingControls = useRecordingReminder(callRef, roomName ?? roomUrl?.split("/").pop());
  const { dispatch: dispatchRecording, active: recording, copy: recordingCopy, state: recordingState } = recordingControls;
  const recordingControlsRef = useRef(recordingControls);
  recordingControlsRef.current = recordingControls;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [safetyMode, setSafetyMode] = useState<null | "report" | "block">(null);
  const [joinPrefs, setJoinPrefs] = useState<{ mic: boolean; cam: boolean }>({
    mic: true,
    cam: true,
  });

  // Reset phase whenever the sheet reopens (or roomUrl changes between calls).
  useEffect(() => {
    if (open) setPhase("lobby");
  }, [open, roomUrl]);

  // Initialize Daily frame only once we move to "live" phase.
  useEffect(() => {
    if (phase !== "live" || !roomUrl || !containerRef.current) return;

    let cancelled = false;
    let frame: DailyCall | null = null;
    const container = containerRef.current;
    setJoining(true);
    startedAtRef.current = Date.now();

    // Track network-quality fallback state outside the async block so the
    // event handler closes over the right variables.
    let lowSince: number | null = null;
    let fellBack = false;

    (async () => {
      try {
        frame = await createDailyFrameAsync(container, {
          iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "0" },
          showLeaveButton: false,
          showFullscreenButton: true,
        });
      } catch (err: any) {
        console.error("[VideoCallSheet] createFrame failed", err);
        if (!cancelled) {
          setJoining(false);
          toast({
            title: "Couldn't start the call",
            description: err?.message || "Please refresh and try again.",
            variant: "destructive",
          });
        }
        return;
      }

      if (cancelled) {
        try { await frame.destroy(); } catch {}
        return;
      }
      callRef.current = frame;
      setMediaCall(frame);
      frame.on("network-connection", event => setConnectionStatus(event.event === "connected" ? "Live" : "Reconnecting"));

      frame.on("left-meeting", () => onOpenChange(false));
      frame.on("recording-started", (ev: any) => {
        recordingControlsRef.current.onStarted(ev);
        didRecordRef.current = true;
        const startedByMe = ev?.local;
        if (!startedByMe) {
          toast({
            title: "🔴 This call is being recorded",
            description: "The host has started recording.",
          });
        }
      });
      frame.on("recording-stopped", () => recordingControlsRef.current.onStopped());
      frame.on("recording-error", (ev: { errorMsg?: string; error?: string } | undefined) => {
        dispatchRecording({ type: "error", message: ev?.errorMsg ?? ev?.error ?? null });
        toast({
          title: "Recording failed",
          description: "The recording stopped with an error. Nothing from this attempt was saved. You can start it again.",
          variant: "destructive",
        });
      });

      frame.on("network-quality-change", (ev: any) => {
        const q = ev?.threshold ?? ev?.quality;
        const isLow = q === "low" || q === "very-low" || (typeof q === "number" && q < 25);
        const now = Date.now();
        if (isLow) {
          if (lowSince === null) lowSince = now;
          if (!fellBack && now - lowSince > 5_000) {
            fellBack = true;
            try {
              void frame?.setLocalVideo(false);
              toast({
                title: "Switched to audio-only",
                description: "Your connection looks weak — video is off so the call stays clear.",
              });
            } catch (e) {
              console.warn("[VideoCallSheet] fallback failed", e);
            }
          }
        } else {
          lowSince = null;
        }
      });

      frame.on("participant-updated", (ev: any) => {
        const p = ev?.participant;
        if (p && !p.local && p.screen) {
          const key = `__screenSharedShown_${p.session_id}`;
          if (!(frame as any)[key]) {
            (frame as any)[key] = true;
            toast({
              title: "Screen sharing started",
              description: `${p.user_name || "Someone"} is sharing their screen.`,
            });
          }
        } else if (p && !p.local && !p.screen) {
          delete (frame as any)[`__screenSharedShown_${p.session_id}`];
        }
      });

      try {
        await frame.join({
          url: roomUrl,
          token: token || undefined,
          userName,
          startVideoOff: !joinPrefs.cam,
          startAudioOff: !joinPrefs.mic,
        });
        if (!cancelled) { setJoining(false); setConnectionStatus("Live"); }
        if (!cancelled && isHost && autoStartRecording && !backstage) {
          dispatchRecording({ type: "start-requested" });
          // startRecording() returns nothing; a refusal arrives as a `recording-error` event.
          try {
            frame.startRecording();
          } catch (e) {
            console.warn("[VideoCallSheet] auto-record failed", e);
            dispatchRecording({ type: "error", message: e instanceof Error ? e.message : null });
          }
        }
      } catch (err: any) {
        console.error("[VideoCallSheet] join failed", err);
        if (!cancelled) {
          setJoining(false);
          toast({
            title: "Couldn't join the call",
            description: err?.message || "Please try again.",
            variant: "destructive",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      const ended = Date.now();
      const duration = startedAtRef.current
        ? Math.round((ended - startedAtRef.current) / 1000)
        : 0;

      if (callId && duration > 0) {
        const table = directCallId ? "direct_video_calls" : "project_video_calls";
        void supabase
          .from(table)
          .update({
            ended_at: new Date(ended).toISOString(),
            duration_seconds: duration,
          })
          .eq("id", callId)
          .then(({ error }) => {
            if (error) console.error("[VideoCallSheet] log end failed", error);
          });
      }

      if (didRecordRef.current) {
        sonnerToast.success("Recap is being prepared", {
          description: "We're saving your recording. It shows up in Recordings a few minutes after the call ends; longer calls take longer.",
          duration: 10_000,
          action: {
            label: "Open Recordings",
            onClick: () => navigate("/recordings"),
          },
        });
        // Poll Daily directly for the finished recording (doesn't rely on the Daily → Supabase webhook
        // being configured). Daily finalises a recording some time after leave(), longer for longer
        // calls, so keep looking for ~10 minutes and stop as soon as it is stored.
        const derived = roomName ?? roomUrl?.split("/").pop() ?? undefined;
        const sinceTs = startedAtRef.current ? Math.floor(startedAtRef.current / 1000) : undefined;
        scheduleRecordingSync({
          roomName: derived,
          sinceTs,
          run: async ({ roomName: rn, sinceTs: since }) => {
            const { data, error } = await supabase.functions.invoke("sync-daily-recordings", {
              body: { room_name: rn, since_ts: since },
            });
            if (error) throw error;
            return readSyncOutcome(data, since);
          },
          onStored: () =>
            sonnerToast.success("Recording saved", {
              description: "It is in Recordings now.",
              action: { label: "Open Recordings", onClick: () => navigate("/recordings") },
            }),
        });
      } else if (duration > 30) {
        sonnerToast("Want a recap next time?", {
          description: "Tap Record during a call and we'll auto-summarize action items + decisions.",
          duration: 7_000,
        });
      }

      const f = frame ?? callRef.current;
      callRef.current = null;
      setMediaCall(null);
      // Fire-and-forget async teardown; awaiting destroy prevents the next
      // mount from crashing on a half-torn-down singleton.
      void (async () => {
        try { await f?.leave(); } catch {}
        try { await f?.destroy(); } catch {}
        // Belt-and-braces: ensure the singleton slot is empty for the next call.
        try { await destroyExistingDailyFrameAsync(); } catch {}
      })();
    };
  }, [phase, roomUrl, token, callId, userName, directCallId, onOpenChange, joinPrefs, toast, navigate, isHost, autoStartRecording, backstage]);


  const endConfirmed = async () => {
    try { await callRef.current?.leave(); } catch {}
    try { callRef.current?.destroy(); } catch {}
    callRef.current = null;
    onOpenChange(false);
  };

  const handleEnd = () => setConfirmLeave(true);

  const toggleRecording = async () => {
    if (recordingState.phase === "recording") { recordingControls.stopRecording(); return; }
    if (["requested", "stopping", "processing"].includes(recordingState.phase)) return;
    const stopping = recording;
    try {
      dispatchRecording({ type: stopping ? "stop-requested" : "start-requested" });
      if (stopping) await callRef.current?.stopRecording();
      else await callRef.current?.startRecording();
    } catch (e) {
      const message = e instanceof Error ? e.message : undefined;
      dispatchRecording({ type: "error", message });
      toast({ title: "Recording unavailable", description: message, variant: "destructive" });
    }
  };

  const muteAll = async () => {
    const call = callRef.current;
    if (!call) return;
    try {
      const parts = call.participants() as Record<string, { session_id: string; local?: boolean; owner?: boolean }>;
      const updates: Record<string, { setAudio: false }> = {};
      Object.values(parts).forEach((p) => {
        if (!p.local && !p.owner) updates[p.session_id] = { setAudio: false };
      });
      if (Object.keys(updates).length === 0) {
        toast({ title: "No one to mute", description: "Only you are unmuted right now." });
        return;
      }
      await call.updateParticipants(updates);
      toast({ title: "Muted everyone", description: "Speakers can unmute themselves when they're ready." });
    } catch (e: any) {
      toast({ title: "Couldn't mute everyone", description: e?.message, variant: "destructive" });
    }
  };

  const derivedRoomName = roomName ?? roomUrl?.split("/").pop() ?? "";

  return createPortal(
    <>
      <StudioCallSurface live={phase === "live"} open={open} onOpenChange={onOpenChange} route={originRoute} title={projectName} call={mediaCall} startedAt={startedAtRef.current} recordingPhase={recordingState.phase} status={connectionStatus} onLeave={() => { void endConfirmed(); }}>
          {/* Phase 1: Pre-call lobby */}
          {phase === "lobby" ? (
            <div className="relative h-full">
              <CallPreflightGate
                shareUrl={meetingShareUrl ?? roomUrl ?? null}
                onCancel={() => onOpenChange(false)}
              >
                <PreCallLobby
                  projectName={projectName}
                  joining={joining}
                  ctaLabel={lobbyCta}
                  onCancel={() => onOpenChange(false)}
                  onJoin={(opts) => {
                    setJoinPrefs(opts);
                    setPhase("live");
                  }}
                />
              </CallPreflightGate>
              {roomUrl && (
                <Button variant="ghost"
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="!absolute bottom-40 right-3 z-10 min-h-11 px-3.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary text-foreground text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm border border-border"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite people
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Header */}
              <header className="k-call-header flex items-center justify-between border-b shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <CallBrand />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate leading-tight">
                      {projectName}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight flex items-center gap-1.5">
                      {backstage ? (
                        <>
                          <Circle className="h-2 w-2 fill-warning text-warning" />
                          <span className="text-warning font-bold uppercase tracking-wide">Backstage · doors closed</span>
                        </>
                      ) : recordingCopy ? (
                        <>
                          <Circle
                            className={`h-2 w-2 ${
                              recordingCopy.tone === "danger"
                                ? "fill-destructive text-destructive"
                                : recordingCopy.tone === "success"
                                  ? "fill-success text-success"
                                  : "fill-warning text-warning"
                            }`}
                          />
                          <span
                            role="status"
                            className={`font-medium ${recordingCopy.tone === "danger" ? "text-destructive" : "text-foreground"}`}
                          >
                            {recordingCopy.label}
                          </span>
                        </>
                      ) : joining ? (
                        "Connecting…"
                      ) : (
                        "Live call"
                      )}
                    </p>
                  </div>
                </div>
                <CallMediaControls call={mediaCall} toolbar>
                  {!backstage && (
                    <Button
                      type="button"
                      variant="ghost"
                      title={recording ? "Stop recording" : "Start recording"}
                      aria-label={recording ? "Stop recording" : "Start recording"}
                      aria-pressed={recording}
                      onClick={toggleRecording}
                      disabled={["requested", "stopping", "processing"].includes(recordingState.phase)}
                      className={`k-call-icon rounded-lg ${recording ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-secondary text-foreground hover:bg-accent"}`}
                    >
                      <Circle className={`h-3.5 w-3.5 ${recording ? "fill-current" : ""}`} />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" type="button" aria-label="More call options" title="More" className="k-call-icon rounded-lg bg-secondary text-foreground hover:bg-accent">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => setInviteOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" /> Invite people
                      </DropdownMenuItem>
                      {isHost && (
                        <DropdownMenuItem onClick={muteAll} title="Mute every speaker except you">
                          <MicOff className="h-4 w-4 mr-2" /> Mute all
                        </DropdownMenuItem>
                      )}
                      {peerUserId && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSafetyMode("report")} className="text-destructive focus:text-destructive">
                            <Flag className="h-4 w-4 mr-2" /> Report {peerName || "this person"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSafetyMode("block")} className="text-destructive focus:text-destructive">
                            <Ban className="h-4 w-4 mr-2" /> Block & don't reconnect
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleEnd}
                    title="Leave call"
                    aria-label="Leave call"
                    className="k-call-icon rounded-lg"
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </CallMediaControls>
              </header>

              {/* Video area */}
              <div className="k-call-video relative flex-1 min-h-0">
                <div ref={containerRef} className="absolute inset-0" />
                {!backstage && <RecordingReminder visible={recordingControls.reminder} onStop={recordingControls.stopRecording} onSave={recordingControls.saveRecording} onDismiss={recordingControls.dismissReminder} segment={recordingControls.segment} onClearSegment={recordingControls.clearSegment} />}
                {joining && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-foreground gap-3 z-10">
                    <KretopiaSpinner className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium text-foreground">Connecting to the room…</p>
                  </div>
                )}
                {overlayActions && (
                  <div className="absolute inset-0 z-20 pointer-events-none [&>*]:pointer-events-auto">
                    {overlayActions}
                  </div>
                )}
              </div>
            </>
          )}
      </StudioCallSurface>
      <ConfirmCallLeave open={confirmLeave} onOpenChange={setConfirmLeave} onLeave={() => { void endConfirmed(); }} />

      {/* Invite sheet — available from both lobby & live so callers can add contacts before joining */}
      {roomUrl && (
        <CallInviteSheet
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          callContext={{
            kind: directCallId ? "direct" : "project",
            projectId: projectId ?? null,
            projectName,
            directCallId: directCallId ?? null,
            roomUrl,
            roomName: derivedRoomName,
            callId: callId ?? null,
            callerName: userName,
            callerAvatar: userAvatar ?? null,
            meetingShareUrl: meetingShareUrl ?? null,
          }}
        />
      )}

      {peerUserId && (
        <ReportBlockDialog
          open={!!safetyMode}
          onOpenChange={(v) => !v && setSafetyMode(null)}
          targetUserId={peerUserId}
          targetUserName={peerName || "this person"}
          mode={safetyMode ?? "report"}
          onBlocked={() => {
            setSafetyMode(null);
            onPeerBlocked?.();
            void handleEnd();
          }}
        />
      )}
    </>
  , document.body);
};

function StudioCallSurface({ live, open, onOpenChange, ...props }: React.ComponentProps<typeof PersistentCallWindow> & { live: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (live) return <PersistentCallWindow {...props} />;
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" className="k-call-surface h-[100dvh] sm:h-[92dvh] max-h-[100dvh] p-0 flex flex-col bg-background border-t-0 gap-0 [&>button.absolute]:hidden">{props.children}</SheetContent></Sheet>;
}
