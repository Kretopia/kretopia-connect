// /meet/:meetingId — universal entry point for hosts, members, and guests.
// Guests must include ?t=<share_token>.
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { type DailyCall } from "@daily-co/daily-js";
import { createDailyFrameAsync, teardownDailyCall } from "@/lib/dailyFrame";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { extractInvokeError } from "@/lib/extractInvokeError";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  PhoneOff,
  ScreenShare,
  Circle,
  Copy,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CallPreflightGate } from "@/components/calls/CallPreflightGate";
import { Greenroom } from "@/components/calls/Greenroom";
import { AdmitQueue } from "@/components/calls/AdmitQueue";

type Phase = "loading" | "lobby" | "live" | "ended" | "error";

interface JoinPrefs {
  mic: boolean;
  cam: boolean;
  micDeviceId?: string;
  camDeviceId?: string;
  speakerDeviceId?: string;
}

export default function CallPage() {
  const { meetingId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("t") ?? undefined;
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const callRef = useRef<DailyCall | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("Joining call");
  const [recording, setRecording] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [joinPrefs, setJoinPrefs] = useState<JoinPrefs | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{
    token: string;
    roomUrl: string;
  } | null>(null);

  const isHost = role === "host";

  // Initial fetch — verifies the meeting exists and we're allowed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userName =
          user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
        const { data, error } = await supabase.functions.invoke(
          "mint-meeting-token",
          {
            body: {
              meeting_id: meetingId,
              share_token: shareToken,
              user_name: userName || undefined,
            },
          },
        );
        if (cancelled) return;
        if (error || !data?.token) {
          setError(data?.error || (await extractInvokeError(error)) || "Couldn't load meeting");
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
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingId, shareToken, user]);

  // Spin up Daily once we're "live"
  useEffect(() => {
    if (phase !== "live" || !tokenInfo || !containerRef.current) return;
    let cancelled = false;
    let frame: import("@daily-co/daily-js").DailyCall | null = null;
    const container = containerRef.current;

    (async () => {
    try {
      frame = await createDailyFrameAsync(container, {
        iframeStyle: { width: "100%", height: "100%", border: "0" },
        showLeaveButton: false,
        showFullscreenButton: true,
      });
    } catch (err: any) {
      console.error("[CallPage] createFrame failed", err);
      if (!cancelled) {
        setError(err?.message || "Couldn't start the call");
        setPhase("error");
      }
      return;
    }
    if (cancelled) { await teardownDailyCall(frame); return; }
    callRef.current = frame;

    const userName =
      guestName ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "Guest";

    const prefs = joinPrefs ?? { mic: false, cam: false };

    frame
      .join({
        url: tokenInfo.roomUrl,
        token: tokenInfo.token,
        userName,
        startVideoOff: !prefs.cam,
        startAudioOff: !prefs.mic,
      })
      .then(async () => {
        // Apply selected devices once joined
        try {
          if (prefs.micDeviceId || prefs.camDeviceId || prefs.speakerDeviceId) {
            await (frame as any).setInputDevicesAsync?.({
              audioDeviceId: prefs.micDeviceId,
              videoDeviceId: prefs.camDeviceId,
            });
            if (prefs.speakerDeviceId) {
              await (frame as any).setOutputDeviceAsync?.({
                outputDeviceId: prefs.speakerDeviceId,
              });
            }
          }
        } catch (e) {
          console.warn("[CallPage] device apply", e);
        }
      })
      .catch((err) => {
        console.error("[CallPage] join failed", err);
        toast({
          title: "Couldn't join",
          description: err?.message,
          variant: "destructive",
        });
        setPhase("error");
        setError(err?.message || "Failed to join");
      });

    frame.on("left-meeting", () => setPhase("ended"));
    frame.on("recording-started", () => setRecording(true));
    frame.on("recording-stopped", () => setRecording(false));
    frame.on("local-screen-share-started", () => setSharing(true));
    frame.on("local-screen-share-stopped", () => setSharing(false));
    })();

    return () => {
      cancelled = true;
      const f = frame ?? callRef.current;
      callRef.current = null;
      void teardownDailyCall(f);
    };
  }, [phase, tokenInfo, user, guestName, joinPrefs, toast]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast({ title: "Invite link copied" });
  };

  const toggleRecord = async () => {
    try {
      recording
        ? await callRef.current?.stopRecording()
        : await callRef.current?.startRecording();
    } catch (e: any) {
      toast({ title: "Recording unavailable", description: e?.message, variant: "destructive" });
    }
  };
  const toggleShare = async () => {
    try {
      sharing
        ? await callRef.current?.stopScreenShare()
        : await callRef.current?.startScreenShare();
    } catch (e: any) {
      toast({ title: "Couldn't share", description: e?.message, variant: "destructive" });
    }
  };
  const leave = async () => {
    try { await callRef.current?.leave(); } catch {}
    setPhase("ended");
  };

  // ---------- Renders ----------
  if (phase === "loading") {
    return (
      <FullScreen>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading meeting…</p>
      </FullScreen>
    );
  }

  if (phase === "error") {
    return (
      <FullScreen>
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">Can't open this meeting</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/")}>Back to home</Button>
        </div>
      </FullScreen>
    );
  }

  if (phase === "ended") {
    return (
      <FullScreen>
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">You left the call</h1>
          <p className="text-sm text-muted-foreground">
            Recording and transcript (if enabled) will appear shortly.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setPhase("lobby")}>
              Rejoin
            </Button>
            <Button onClick={() => navigate("/")}>Done</Button>
          </div>
        </div>
      </FullScreen>
    );
  }

  // LOBBY (Greenroom)
  if (phase === "lobby") {
    const ctaLabel = isHost ? "Start call" : "Knock to join";
    return (
      <div className="min-h-[100dvh] bg-[#0b0b0f] text-white">
        <div className="relative min-h-[100dvh]">
          <CallPreflightGate
            shareUrl={typeof window !== "undefined" ? window.location.href : null}
            onCancel={() => navigate("/")}
          >
            <Greenroom
              title={title}
              needsName={!user}
              guestName={guestName}
              onGuestNameChange={setGuestName}
              ctaLabel={ctaLabel}
              onJoin={(prefs) => {
                setJoinPrefs(prefs);
                setPhase("live");
              }}
              secondary={
                <Button
                  variant="ghost"
                  onClick={copyLink}
                  className="w-full text-white/80 hover:text-white hover:bg-white/10"
                >
                  <Copy className="h-4 w-4" />
                  Copy invite link
                </Button>
              }
            />
          </CallPreflightGate>
        </div>
      </div>
    );
  }

  // LIVE
  return (
    <div className="min-h-[100dvh] bg-[#0b0b0f] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0b0b0f]">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[11px] text-white/50 flex items-center gap-1.5">
            {recording ? (
              <>
                <Circle className="h-2 w-2 fill-destructive text-destructive" />
                <span className="text-destructive font-medium">Recording</span>
              </>
            ) : (
              "Live"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={leave}
          className="h-9 w-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="relative flex-1 min-h-0 bg-black">
        <div ref={containerRef} className="absolute inset-0" />
        <AdmitQueue call={callRef.current} isHost={isHost} />
      </div>

      <div
        className="px-3 pt-3 border-t border-white/5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleShare}
            className={`rounded-full gap-2 h-10 px-4 border border-white/10 ${
              sharing
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            <ScreenShare className="h-4 w-4" />
            {sharing ? "Stop" : "Share"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleRecord}
            className={`rounded-full gap-2 h-10 px-4 border border-white/10 ${
              recording
                ? "bg-destructive text-destructive-foreground border-transparent"
                : "bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            <Circle className={`h-3 w-3 ${recording ? "fill-current" : ""}`} />
            {recording ? "Stop" : "Record"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyLink}
            className="rounded-full gap-2 h-10 px-4 border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Copy className="h-4 w-4" />
            Invite
          </Button>
          <Button
            type="button"
            onClick={leave}
            className="rounded-full gap-2 h-11 px-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <PhoneOff className="h-4 w-4" />
            <span className="font-semibold">Leave</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6">
      {children}
    </div>
  );
}
