// /call/:token — a guest link to a live call. Public: anyone with the link can come in.
//
// This page owns no call. It settles who is coming in (sign in or continue as a guest), asks for the name the others will see, redeems the
// link for that name, and hands the room to the one call the app shell owns (VideoCallSheet -> PersistentStudioCall): the same lobby,
// frame and toolbar as every other call. It used to carry a call of its own, with its own frame, header and a second row of controls at
// the bottom, which sat under Daily's own tray; see VideoCallContext.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { SEO } from "@/components/SEO";
import { GuestEntryChoice } from "@/components/auth/GuestEntryChoice";
import { CallEntryScreen } from "@/components/calls/CallEntryScreen";
import { GuestNameStep } from "@/components/calls/GuestNameStep";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { CALL_BUSY_DESCRIPTION, CALL_BUSY_TITLE, useVideoCall } from "@/contexts/VideoCallContext";
import { useEntryChoice } from "@/hooks/useEntryChoice";
import { redeemGuestLink, type CallCredentials } from "@/lib/callCredentials";

type Stage = "name" | "resolving" | "calling" | "ended" | "error";
interface StartedCall {
  creds: CallCredentials;
  userName: string;
}

export default function GuestCall() {
  const { token = "" } = useParams<{ token: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // Someone who is not signed in picks "sign in" or "continue as guest" before the name step.
  const entry = useEntryChoice(`call:${token}`);
  const { studioCall } = useVideoCall();
  const sourceId = `guest:${token}`;

  const [stage, setStage] = useState<Stage>("name");
  const [started, setStarted] = useState<StartedCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wanted = useRef<string | null>(null);

  const ownLive = studioCall?.sourceId === sourceId && studioCall.roomUrl ? studioCall : null;
  const otherLive = !!studioCall && !ownLive;
  // A signed-in person arrives with their name already filled in.
  const knownName: string = entry.user?.user_metadata?.full_name || "";

  // Back on the page while its call is live: take that call over.
  useEffect(() => {
    if (!ownLive || stage === "calling") return;
    setStarted({ creds: { roomUrl: ownLive.roomUrl ?? "", token: ownLive.token ?? "", title: ownLive.projectName, isHost: false }, userName: ownLive.userName });
    setStage("calling");
  }, [ownLive, stage]);

  // Another call is live: say so once, and do not redeem anything.
  useEffect(() => {
    if (!otherLive || stage === "calling" || stage === "error") return;
    toast(CALL_BUSY_TITLE, { description: CALL_BUSY_DESCRIPTION });
    setError(`${CALL_BUSY_TITLE}. ${CALL_BUSY_DESCRIPTION}`);
    setStage("error");
  }, [otherLive, stage]);
  useEffect(() => () => { wanted.current = null; }, []);

  const submitName = useCallback((name: string) => {
    if (!token) return;
    const key = `${token}|${name}`;
    wanted.current = key;
    setStage("resolving");
    redeemGuestLink(token, name)
      .then((creds) => {
        if (wanted.current !== key) return;
        setStarted({ creds, userName: name });
        setStage("calling");
      })
      .catch((e: Error) => {
        if (wanted.current !== key) return;
        setError(e.message || "Couldn't join the call");
        setStage("error");
      });
  }, [token]);

  // The call closed: left, or cancelled in the lobby.
  const handleCallOpenChange = useCallback((open: boolean) => {
    if (open) return;
    setStarted(null);
    setStage("ended");
  }, []);

  if (entry.needsChoice) {
    return (
      <GuestEntryChoice
        title="You're invited to a live call"
        signInTo={`${location.pathname}${location.search}`}
        signInHint="Join with your Kretopia account."
        guestHint="Join with just your name."
        onContinueAsGuest={entry.continueAsGuest}
      />
    );
  }

  if (entry.pending) {
    return (
      <CallEntryScreen>
        <KretopiaSpinner className="h-8 w-8 text-primary" />
      </CallEntryScreen>
    );
  }

  if (stage === "name" && !ownLive) {
    return (
      <>
        <SEO title="Join the call · Kretopia" description="Join a live Kretopia room." />
        <GuestNameStep title="You're invited to a live call" hint="Enter your name to join." cta="Join call" initialName={knownName} onSubmit={submitName} />
      </>
    );
  }

  if (stage === "error") {
    return (
      <CallEntryScreen>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-semibold">Couldn't join</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => { setError(null); setStage("name"); }}>Try again</Button>
        </div>
      </CallEntryScreen>
    );
  }

  if (stage === "ended") {
    return (
      <CallEntryScreen>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-semibold">You left the call</h1>
          <p className="text-sm text-muted-foreground">It's safe to close this tab.</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setStage("name")}>Rejoin</Button>
            <Button onClick={() => navigate("/")}>Done</Button>
          </div>
        </div>
      </CallEntryScreen>
    );
  }

  // Redeeming, or in the call's own lobby: the call is drawn by the app shell, over this page.
  return (
    <CallEntryScreen>
      <KretopiaSpinner className="h-8 w-8 text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">Joining the call…</p>
      {started && (
        <VideoCallSheet
          open={stage === "calling"}
          onOpenChange={handleCallOpenChange}
          projectName={started.creds.title}
          roomUrl={started.creds.roomUrl}
          token={started.creds.token}
          callId={null}
          userName={started.userName}
          lobbyCta="Join call"
          sourceId={sourceId}
        />
      )}
    </CallEntryScreen>
  );
}
