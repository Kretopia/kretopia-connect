import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import type { IncomingCall } from "@/hooks/useIncomingCall";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";

interface Props {
  call: IncomingCall | null;
  onClose: () => void;
}

/**
 * Full-screen incoming-call ringer. On Accept:
 * - Project calls: navigates to /desk/:id and lets the room auto-join.
 * - Direct (1:1) calls: mints a meeting token via create-direct-video-call's
 *   sibling token endpoint by re-invoking create-video-room semantics is not
 *   needed — we re-use the room_name passed by the caller and call
 *   redeem-video-guest-link's pattern is unnecessary. Instead we open the
 *   VideoCallSheet with no token (Daily allows joining a private room with
 *   just a token; for direct calls the caller pre-mints a per-recipient
 *   token by calling create-direct-call-token).
 */
export const IncomingCallModal = ({ call, onClose }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<number | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  // Play an audible ringtone (two-tone WebAudio chime, looped) while the modal is open.
  useEffect(() => {
    if (!call) return;
    let stopped = false;
    const Ctx: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;

    const playPing = () => {
      if (stopped || ctx.state === "closed") return;
      const now = ctx.currentTime;
      [0, 0.18].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = i === 0 ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.18);
      });
    };

    // Some browsers require a user gesture; resume() will succeed if the modal
    // mounts in response to a notification interaction, otherwise stays silent.
    void ctx.resume().catch(() => {});
    playPing();
    ringIntervalRef.current = window.setInterval(playPing, 1800);

    return () => {
      stopped = true;
      if (ringIntervalRef.current !== null) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
      try { void ctx.close(); } catch {}
      audioCtxRef.current = null;
    };
  }, [call]);

  const decline = () => {
    onClose();
  };

  const accept = async () => {
    if (!call || !user) return;
    setAccepting(true);
    try {
      if (call.kind === "project" && call.projectId) {
        // Navigate to the project; the project header subscribes to the same
        // room and will auto-open the call.
        navigate(`/desk/${call.projectId}?joinCall=1`);
        onClose();
        return;
      }

      // Direct call: mint a token for this recipient via a lightweight token endpoint.
      const myName =
        user.user_metadata?.full_name || user.email?.split("@")[0] || "Guest";
      const { data, error } = await supabase.functions.invoke("mint-video-token", {
        body: { room_name: call.roomName, user_name: myName },
      });
      if (error) throw error;
      setJoinUrl(call.roomUrl);
      setJoinToken(data?.token ?? null);
      setCallId(call.callId ?? null);
    } catch (e) {
      console.error("[IncomingCallModal accept]", e);
      onClose();
    } finally {
      setAccepting(false);
    }
  };

  if (joinUrl) {
    return (
      <VideoCallSheet
        open={true}
        onOpenChange={(o) => {
          if (!o) {
            setJoinUrl(null);
            setJoinToken(null);
            setCallId(null);
            onClose();
          }
        }}
        projectName={call?.projectName ?? `Call with ${call?.callerName}`}
        roomUrl={joinUrl}
        token={joinToken}
        callId={callId}
        userName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest"}
        lobbyCta="Join call"
      />
    );
  }

  return (
    <Dialog open={!!call} onOpenChange={(o) => !o && decline()}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden border-0 bg-gradient-to-b from-primary/10 to-background">
        <DialogTitle className="sr-only">Incoming call</DialogTitle>
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Incoming {call?.kind === "project" ? "room call" : "call"}
          </p>
          <Avatar className="h-24 w-24 ring-4 ring-primary/30 animate-pulse mb-4">
            <AvatarImage src={call?.callerAvatar ?? undefined} />
            <AvatarFallback className="text-2xl">
              {(call?.callerName ?? "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-semibold">{call?.callerName ?? "Someone"}</h2>
          {call?.projectName && (
            <p className="text-sm text-muted-foreground mt-1">on {call.projectName}</p>
          )}
        </div>
        <div className="flex items-center justify-around px-6 pb-8">
          <button
            type="button"
            onClick={decline}
            className="flex flex-col items-center gap-2"
            aria-label="Decline call"
          >
            <span className="h-14 w-14 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition">
              <PhoneOff className="h-6 w-6 text-destructive-foreground" />
            </span>
            <span className="text-xs">Decline</span>
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={accepting}
            className="flex flex-col items-center gap-2"
            aria-label="Accept call"
          >
            <span className="h-14 w-14 rounded-full bg-green-500 flex items-center justify-center shadow-lg active:scale-95 transition animate-pulse">
              {accepting ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Phone className="h-6 w-6 text-white" />
              )}
            </span>
            <span className="text-xs">Accept</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
