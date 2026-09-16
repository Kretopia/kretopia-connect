import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast as sonnerToast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  PhoneOff,
  Loader2,
  UserPlus,
  Circle,
  ScreenShare,
  X,
  MoreVertical,
  Flag,
  Ban,
  ShieldAlert,
  MicOff,
} from "lucide-react";
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

interface VideoCallSheetProps {
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

export const VideoCallSheet = ({
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
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callRef = useRef<DailyCall | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const didRecordRef = useRef<boolean>(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [joining, setJoining] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sharing, setSharing] = useState(false);
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

      frame.on("left-meeting", () => onOpenChange(false));
      frame.on("recording-started", (ev: any) => {
        setRecording(true);
        didRecordRef.current = true;
        const startedByMe = ev?.local;
        if (!startedByMe) {
          toast({
            title: "🔴 This call is being recorded",
            description: "The host has started recording.",
          });
        }
      });
      frame.on("recording-stopped", () => setRecording(false));
      frame.on("local-screen-share-started", () => setSharing(true));
      frame.on("local-screen-share-stopped", () => setSharing(false));

      frame.on("network-quality-change", (ev: any) => {
        const q = ev?.threshold ?? ev?.quality;
        const isLow = q === "low" || q === "very-low" || (typeof q === "number" && q < 25);
        const now = Date.now();
        if (isLow) {
          if (lowSince === null) lowSince = now;
          if (!fellBack && now - lowSince > 5_000) {
            fellBack = true;
            try {
              void frame!.setLocalVideo(false);
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
        if (!cancelled) setJoining(false);
        if (!cancelled && isHost && autoStartRecording && !backstage) {
          try {
            void frame.startRecording();
          } catch (e) {
            console.warn("[VideoCallSheet] auto-record failed", e);
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

      if (duration > 30) {
        if (didRecordRef.current) {
          sonnerToast.success("Recap is being prepared", {
            description: "Find it in Messages › Calls in ~2 min. We'll pull action items + decisions.",
            duration: 10_000,
            action: {
              label: "Open Calls",
              onClick: () => navigate("/messages?tab=calls"),
            },
          });
          // Poll Daily directly for the finished recording (doesn't rely on
          // the Daily → Supabase webhook being configured). Daily needs
          // 30-60s after leave() to finalize; try a couple of times.
          const derived = roomName ?? roomUrl?.split("/").pop() ?? undefined;
          const sync = () =>
            supabase.functions
              .invoke("sync-daily-recordings", { body: { room_name: derived } })
              .catch((e) => console.warn("[VideoCallSheet] sync failed", e));
          setTimeout(sync, 45_000);
          setTimeout(sync, 120_000);
        } else {
          sonnerToast("Want a recap next time?", {
            description: "Tap Record during a call and we'll auto-summarize action items + decisions.",
            duration: 7_000,
          });
        }
      }


      const f = frame ?? callRef.current;
      callRef.current = null;
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


  const handleEnd = async () => {
    try { await callRef.current?.leave(); } catch {}
    try { callRef.current?.destroy(); } catch {}
    callRef.current = null;
    onOpenChange(false);
  };

  const toggleRecording = async () => {
    try {
      if (recording) await callRef.current?.stopRecording();
      else await callRef.current?.startRecording();
    } catch (e: any) {
      toast({ title: "Recording unavailable", description: e?.message, variant: "destructive" });
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (sharing) await callRef.current?.stopScreenShare();
      else await callRef.current?.startScreenShare();
    } catch (e: any) {
      toast({ title: "Couldn't share screen", description: e?.message, variant: "destructive" });
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] sm:h-[92dvh] p-0 flex flex-col bg-[#0b0b0f] border-t-0 gap-0 [&>button.absolute]:hidden"
        >
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
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm border border-white/10"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite people
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0 bg-[#0b0b0f]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-base">📹</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-tight">
                      {projectName}
                    </p>
                    <p className="text-[11px] text-white/50 leading-tight flex items-center gap-1.5">
                      {backstage ? (
                        <>
                          <Circle className="h-2 w-2 fill-amber-400 text-amber-400" />
                          <span className="text-amber-400 font-bold uppercase tracking-wide">Backstage · doors closed</span>
                        </>
                      ) : recording ? (
                        <>
                          <Circle className="h-2 w-2 fill-destructive text-destructive" />
                          <span className="text-destructive font-medium">Recording</span>
                        </>
                      ) : joining ? (
                        "Connecting…"
                      ) : (
                        "Live call"
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {peerUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Safety options"
                          className="h-9 w-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setSafetyMode("report")} className="text-destructive focus:text-destructive">
                          <Flag className="h-4 w-4 mr-2" /> Report {peerName || "this person"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSafetyMode("block")} className="text-destructive focus:text-destructive">
                          <Ban className="h-4 w-4 mr-2" /> Block & don't reconnect
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <button
                    type="button"
                    onClick={handleEnd}
                    aria-label="Close call"
                    className="h-9 w-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </header>

              {/* Video area */}
              <div className="relative flex-1 min-h-0 bg-black">
                <div ref={containerRef} className="absolute inset-0" />
                {joining && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b0b0f] text-white gap-3 z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-white">Connecting to the room…</p>
                  </div>
                )}
                {overlayActions && (
                  <div className="absolute inset-0 z-20 pointer-events-none [&>*]:pointer-events-auto">
                    {overlayActions}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div
                className="px-3 pt-3 border-t border-white/5 bg-[#0b0b0f] shrink-0"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
              >
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleScreenShare}
                    className={`rounded-full gap-2 h-10 px-4 border ${
                      sharing
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
                        : "bg-white/15 text-white border-white/30 hover:bg-white/25"
                    }`}
                  >
                    <ScreenShare className="h-4 w-4" />
                    <span className="text-sm font-medium">{sharing ? "Stop" : "Share"}</span>
                  </Button>

                  {!backstage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={toggleRecording}
                      className={`rounded-full gap-2 h-10 px-4 border ${
                        recording
                          ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-transparent"
                          : "bg-white/15 text-white border-white/30 hover:bg-white/25"
                      }`}
                    >
                      <Circle className={`h-3 w-3 ${recording ? "fill-current" : ""}`} />
                      <span className="text-sm font-medium">{recording ? "Stop" : "Record"}</span>
                    </Button>
                  )}

                  {isHost && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={muteAll}
                      className="rounded-full gap-2 h-10 px-4 border bg-white/15 text-white border-white/30 hover:bg-white/25"
                      title="Mute every speaker except you"
                    >
                      <MicOff className="h-4 w-4" />
                      <span className="text-sm font-medium">Mute all</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviteOpen(true)}
                    className="rounded-full gap-2 h-10 px-4 border bg-white/15 text-white border-white/30 hover:bg-white/25"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="text-sm font-medium">Invite</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleEnd}
                    className="rounded-full gap-2 h-11 px-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span className="text-sm font-semibold">End</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

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
  );
};
