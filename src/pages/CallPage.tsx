// /meet/:meetingId — universal entry point for hosts, members, and guests.
// Guests must include ?t=<share_token>.
//
// CEO hotfix (24/09/2026): the actual live call surface (Daily iframe +
// controls) is no longer owned by this route component -- it lives in
// VideoCallContext + GlobalVideoCallHost, mounted once at the app shell
// level, so navigating away no longer ends the call (it floats in a PiP
// widget instead; see those two files for the how/why). This page still
// owns the pre-join flow (token fetch, Greenroom lobby, error/ended
// screens), since those are inherently full-page, not floating-widget
// content.
import { useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CallPreflightGate } from "@/components/calls/CallPreflightGate";
import { Greenroom } from "@/components/calls/Greenroom";
import { useVideoCall } from "@/contexts/VideoCallContext";

export default function CallPage() {
  const { meetingId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("t") ?? undefined;
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    phase,
    error,
    title,
    isHost,
    guestName,
    setGuestName,
    openMeeting,
    joinLive,
    reset,
  } = useVideoCall();

  useEffect(() => {
    const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
    void openMeeting(meetingId, shareToken, userName || undefined);
    // Intentionally not re-running on every user/openMeeting identity change --
    // openMeeting itself no-ops if this meetingId is already the active one
    // (e.g. navigating back here while the call is live/floating).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, shareToken]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast({ title: "Invite link copied" });
  };

  // ---------- Renders ----------
  if (phase === "idle" || phase === "loading") {
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
          <Button onClick={() => { reset(); navigate("/"); }}>Back to home</Button>
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
            <Button
              variant="outline"
              onClick={() => {
                const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
                void openMeeting(meetingId, shareToken, userName || undefined);
              }}
            >
              Rejoin
            </Button>
            <Button onClick={() => { reset(); navigate("/"); }}>Done</Button>
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
            onCancel={() => { reset(); navigate("/"); }}
          >
            <Greenroom
              title={title}
              needsName={!user}
              guestName={guestName}
              onGuestNameChange={setGuestName}
              ctaLabel={ctaLabel}
              onJoin={(prefs) => {
                const userName = guestName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest";
                joinLive(prefs, userName);
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

  // LIVE — the actual call surface is rendered by GlobalVideoCallHost
  // (mounted once at the app shell level), fixed-position and docked to
  // full-screen because the current route matches this meeting. Nothing to
  // render here.
  return null;
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6">
      {children}
    </div>
  );
}
