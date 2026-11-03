// /meet/:meetingId — the entry point for hosts, members and guests. A guest's link carries ?t=<share_token>.
//
// This page owns no call. It settles who is coming in (sign in or continue as a guest, then a name for a guest), fetches that person's access
// to the room, and hands it to the one call the app shell owns (VideoCallSheet -> PersistentStudioCall): the same lobby, frame and toolbar as
// a Studio or a Messages call. Opening the page again while that call is still live finds it and takes it over instead of fetching access
// a second time. (It used to carry a call of its own, with its own frame, header and controls; see VideoCallContext.)
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { GuestEntryChoice } from "@/components/auth/GuestEntryChoice";
import { CallEntryScreen } from "@/components/calls/CallEntryScreen";
import { GuestNameStep } from "@/components/calls/GuestNameStep";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { CALL_BUSY_DESCRIPTION, CALL_BUSY_TITLE, useVideoCall } from "@/contexts/VideoCallContext";
import { useEntryChoice } from "@/hooks/useEntryChoice";
import { mintMeetingCredentials, type CallCredentials } from "@/lib/callCredentials";
import { signInHref } from "@/lib/entryChoice";

type Stage = "idle" | "resolving" | "calling" | "ended" | "error";
interface StartedCall {
  creds: CallCredentials;
  userName: string;
}

export default function CallPage() {
  const { meetingId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("t") ?? undefined;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;
  // Someone who is not signed in picks "sign in" or "continue as guest" before anything else is shown.
  const entry = useEntryChoice(`meet:${meetingId}`);
  const { studioCall } = useVideoCall();
  const sourceId = `meet:${meetingId}`;

  const [stage, setStage] = useState<Stage>("idle");
  const [started, setStarted] = useState<StartedCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const wanted = useRef<string | null>(null);

  // This meeting's call, still live from before (the page was left and is open again); or a different call that is live.
  const ownLive = studioCall?.sourceId === sourceId && studioCall.roomUrl ? studioCall : null;
  const otherLive = !!studioCall && !ownLive;
  const memberName: string | undefined = user ? user.user_metadata?.full_name || user.email?.split("@")[0] || undefined : undefined;
  const readyToFetch = !!user || (entry.isGuest && !!guestName);

  // Back on the page while its call is live: take that call over.
  useEffect(() => {
    if (!ownLive || stage === "calling") return;
    setStarted({ creds: { roomUrl: ownLive.roomUrl ?? "", token: ownLive.token ?? "", title: ownLive.projectName, isHost: !!ownLive.isHost }, userName: ownLive.userName });
    setStage("calling");
  }, [ownLive, stage]);

  // Another call is live: say so once, and do not fetch anything.
  useEffect(() => {
    if (!otherLive || stage === "calling" || stage === "error") return;
    toast(CALL_BUSY_TITLE, { description: CALL_BUSY_DESCRIPTION });
    setError(`${CALL_BUSY_TITLE}. ${CALL_BUSY_DESCRIPTION}`);
    setStage("error");
  }, [otherLive, stage]);

  // Fetch the person's access once they are settled in. A result that arrives after the page or the person changed is ignored.
  useEffect(() => {
    if (stage !== "idle" || otherLive || ownLive || entry.pending || entry.needsChoice || !readyToFetch) return;
    const key = `${meetingId}|${shareToken ?? ""}|${user?.id ?? guestName}`;
    wanted.current = key;
    setStage("resolving");
    const userName = memberName ?? (guestName || undefined);
    mintMeetingCredentials(meetingId, shareToken, userName)
      .then((creds) => {
        if (wanted.current !== key) return;
        setStarted({ creds, userName: userName ?? "Guest" });
        setStage("calling");
      })
      .catch((e: Error) => {
        if (wanted.current !== key) return;
        setError(e.message);
        setStage("error");
      });
  }, [stage, otherLive, ownLive, entry.pending, entry.needsChoice, readyToFetch, meetingId, shareToken, user?.id, guestName, memberName]);
  useEffect(() => () => { wanted.current = null; }, []);

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
        signInTo={returnPath}
        signInHint="Join with your Kretopia account."
        guestHint="Join with just your name."
        onContinueAsGuest={entry.continueAsGuest}
      />
    );
  }

  if (entry.isGuest && !user && !guestName && !ownLive && stage === "idle") {
    return <GuestNameStep title="Join this meeting" hint="This is the name the others will see." cta="Continue" onSubmit={setGuestName} />;
  }

  if (stage === "error") {
    return (
      <CallEntryScreen>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Can't open this meeting</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {!user && (
              <Button asChild variant="outline">
                <Link to={signInHref(returnPath)}>Sign in</Link>
              </Button>
            )}
            <Button onClick={() => navigate("/")}>Back to home</Button>
          </div>
        </div>
      </CallEntryScreen>
    );
  }

  if (stage === "ended") {
    return (
      <CallEntryScreen>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">You're not in the call</h1>
          <p className="text-sm text-muted-foreground">If it was recorded, the recording shows up in Recordings a few minutes after the call ends.</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => { setError(null); setStage("idle"); }}>Rejoin</Button>
            <Button onClick={() => navigate("/")}>Done</Button>
          </div>
        </div>
      </CallEntryScreen>
    );
  }

  // Opening, or in the call's own lobby: the call is drawn by the app shell, over this page.
  return (
    <CallEntryScreen>
      <KretopiaSpinner className="h-8 w-8 text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">{started ? `Joining ${started.creds.title}…` : "Opening the meeting…"}</p>
      {started && (
        <VideoCallSheet
          open={stage === "calling"}
          onOpenChange={handleCallOpenChange}
          projectName={started.creds.title}
          roomUrl={started.creds.roomUrl}
          token={started.creds.token}
          callId={null}
          userName={started.userName}
          isHost={started.creds.isHost}
          admitKnockers={started.creds.isHost}
          lobbyCta={started.creds.isHost ? "Start call" : "Knock to join"}
          meetingShareUrl={typeof window !== "undefined" ? window.location.href : null}
          sourceId={sourceId}
        />
      )}
    </CallEntryScreen>
  );
}
