import { CallBrand, CallMediaControls } from "@/components/calls/CallMediaControls";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { type DailyCall } from "@daily-co/daily-js";
import { createDailyFrameAsync, teardownDailyCall } from "@/lib/dailyFrame";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  ScreenShare,
  Circle,
  X,
} from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { SEO } from "@/components/SEO";
import { toast } from "sonner";
import { extractInvokeError } from "@/lib/extractInvokeError";

/**
 * Public guest join page. Mirrors the in-app VideoCallSheet experience:
 * branded lobby → live room with explicit Share Screen / Mic / Cam / End
 * controls. Anyone (host or guest) can share their screen — the room is
 * created with `enable_screenshare: true` for all participants.
 */
type Phase = "name" | "live" | "ended" | "error";

export default function GuestCall() {
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("name");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const callRef = useRef<DailyCall | null>(null);
  const [mediaCall, setMediaCall] = useState<DailyCall | null>(null);

  const join = async () => {
    if (!token || !name.trim()) return;
    setJoining(true);
    setPhase("live");
    try {
      const { data, error } = await supabase.functions.invoke(
        "redeem-video-guest-link",
        { body: { token, guest_name: name.trim() } },
      );
      if (error) throw error;
      if (!data?.room_url || !data?.token) throw new Error("Invalid response");

      // Wait one tick for the container to mount.
      await new Promise((r) => setTimeout(r, 0));
      if (!containerRef.current) throw new Error("Call container missing");

      const frame = await createDailyFrameAsync(containerRef.current, {
        iframeStyle: { width: "100%", height: "100%", border: "0" },
        showLeaveButton: false,
        showFullscreenButton: true,
      });
      callRef.current = frame;
      setMediaCall(frame);

      frame.on("left-meeting", () => setPhase("ended"));
      frame.on("local-screen-share-started", () => setSharing(true));
      frame.on("local-screen-share-stopped", () => setSharing(false));
      frame.on("recording-started", (ev: any) => {
        setRecording(true);
        if (!ev?.local) {
          toast("🔴 This call is being recorded", {
            description: "The host has started recording.",
          });
        }
      });
      frame.on("recording-stopped", () => setRecording(false));
      frame.on("participant-updated", (ev: any) => {
        const p = ev?.participant;
        if (p && !p.local && p.screen) {
          const key = `__shareShown_${p.session_id}`;
          if (!(frame as any)[key]) {
            (frame as any)[key] = true;
            toast("Screen sharing started", {
              description: `${p.user_name || "Someone"} is sharing their screen.`,
            });
          }
        } else if (p && !p.local && !p.screen) {
          delete (frame as any)[`__shareShown_${p.session_id}`];
        }
      });

      await frame.join({
        url: data.room_url,
        token: data.token,
        userName: name.trim(),
        startVideoOff: !cam,
        startAudioOff: !mic,
      });
      setJoining(false);
    } catch (e: any) {
      console.error("[GuestCall]", e);
      setErrorMsg((await extractInvokeError(e)) || e?.message || "Couldn't join the call");
      setPhase("error");
      setJoining(false);
    }
  };

  const leave = async () => {
    try { await callRef.current?.leave(); } catch {}
    try { callRef.current?.destroy(); } catch {}
    callRef.current = null;
    setPhase("ended");
  };

  const toggleMic = async () => {
    const next = !mic;
    setMic(next);
    try { await callRef.current?.setLocalAudio(next); } catch (e) { console.warn(e); }
  };
  const toggleCam = async () => {
    const next = !cam;
    setCam(next);
    try { await callRef.current?.setLocalVideo(next); } catch (e) { console.warn(e); }
  };
  const toggleShare = async () => {
    try {
      if (sharing) await callRef.current?.stopScreenShare();
      else await callRef.current?.startScreenShare();
    } catch (e: any) {
      toast.error("Couldn't share screen", {
        description: e?.message || "Screen sharing requires desktop or Android Chrome.",
      });
    }
  };

  useEffect(() => {
    return () => {
      try { callRef.current?.leave(); } catch {}
      try { callRef.current?.destroy(); } catch {}
    };
  }, []);

  return (
    <div className="k-call-surface fixed inset-0 flex flex-col">
      <SEO title="Join the call · Kretopia" description="Join a live Kretopia room." />

      {/* Name entry lobby */}
      {phase === "name" && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-5 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
              <Video className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">You're invited to a live call</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your name to join.</p>
            </div>
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              autoFocus
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button
              className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={join}
              disabled={!name.trim()}
            >
              Join call
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Powered by Kretopia. Camera & mic permission required.
            </p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <p className="font-semibold mb-1">Couldn't join</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <p className="font-semibold mb-1">You left the call</p>
            <p className="text-sm text-muted-foreground">It's safe to close this tab.</p>
          </div>
        </div>
      )}

      {/* Live call */}
      {phase === "live" && (
        <>
          {/* Header */}
          <header className="k-call-header flex items-center justify-between border-b shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <CallBrand />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">Kretopia call</p>
                <p className="text-[11px] text-muted-foreground leading-tight flex items-center gap-1.5">
                  {recording ? (
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
            <Button variant="ghost"
              type="button"
              onClick={leave}
              aria-label="Leave call"
              className="k-call-icon rounded-lg flex items-center justify-center bg-secondary hover:bg-secondary text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          {/* Video area */}
          <div className="k-call-video relative flex-1 min-h-0">
            <div ref={containerRef} className="absolute inset-0" />
            {joining && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 gap-3">
                <KretopiaSpinner className="h-7 w-7 text-primary" />
                <p className="text-sm text-foreground">Connecting to the room…</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div
            className="k-call-footer"
          >
            <CallMediaControls call={mediaCall} />
            <div className="k-call-controls">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={sharing ? "Stop screen sharing" : "Share screen"}
                onClick={toggleShare}
                className={`rounded-full gap-2 h-10 px-4 border border-border ${
                  sharing
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
                    : "bg-secondary text-foreground hover:bg-secondary"
                }`}
              >
                <ScreenShare className="h-4 w-4" />
                <span className="text-sm font-medium">{sharing ? "Stop" : "Share"}</span>
              </Button>

              <Button
                type="button"
                onClick={leave}
                className="rounded-full gap-2 h-11 px-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg"
              >
                <PhoneOff className="h-4 w-4" />
                <span className="text-sm font-semibold">Leave</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
