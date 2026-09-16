import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, Video, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCallHistory } from "@/hooks/useCallHistory";
import { useStartDirectCall } from "@/hooks/useStartDirectCall";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { CallRecapSheet } from "@/components/calls/CallRecapSheet";
import { useAuth } from "@/hooks/useAuth";

const formatDuration = (s: number | null) => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

/**
 * Recent 1:1 video call history with one-tap call-back.
 * Shown as a tab in Messages.
 */
export const CallHistoryPanel = () => {
  const { user } = useAuth();
  const { calls, loading } = useCallHistory();
  const { starting, start, session, open, setOpen, myName } = useStartDirectCall();
  const [recapId, setRecapId] = useState<string | null>(null);

  const handleCallBack = (partnerId: string | null, partnerName: string) => {
    if (!partnerId) return;
    void start(partnerId, partnerName, { context: "call-history-redial" });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading calls…</div>
        ) : calls.length === 0 ? (
          <div className="p-8 text-center">
            <Phone className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-sm">No calls yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap the camera icon in any chat to ring someone.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {calls.map((c) => {
              const isMissed = c.was_missed && c.invited_user_id === user?.id;
              const Icon = isMissed
                ? PhoneMissed
                : c.direction === "outgoing"
                ? PhoneOutgoing
                : PhoneIncoming;
              const tone = isMissed
                ? "text-destructive"
                : c.direction === "outgoing"
                ? "text-muted-foreground"
                : "text-primary";
              const dur = formatDuration(c.duration_seconds);
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
                >
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={c.partnerAvatar ?? undefined} />
                    <AvatarFallback>{c.partnerName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isMissed ? "text-destructive" : ""
                      }`}
                    >
                      {c.partnerName}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Icon className={`h-3 w-3 ${tone}`} />
                      <span>
                        {isMissed
                          ? "Missed"
                          : c.direction === "outgoing"
                          ? "Outgoing"
                          : "Incoming"}
                      </span>
                      {dur && <span>· {dur}</span>}
                      <span>· {formatDistanceToNow(new Date(c.started_at), { addSuffix: true })}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.transcriptId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 gap-1 text-xs text-primary hover:bg-primary/10"
                        onClick={() => setRecapId(c.transcriptId)}
                        aria-label="Open call recap"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">
                          {c.transcriptStatus === "ready" ? "Recap" : "Listening…"}
                        </span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Call ${c.partnerName} back`}
                      disabled={starting || !c.partnerId}
                      onClick={() => handleCallBack(c.partnerId, c.partnerName)}
                      className="rounded-full h-9 w-9 text-primary hover:bg-primary/10"
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      {session && (
        <VideoCallSheet
          open={open}
          onOpenChange={setOpen}
          projectName={`Call with ${calls.find((c) => c.room_name === session.roomName)?.partnerName ?? "you"}`}
          roomUrl={session.roomUrl}
          token={session.token}
          callId={session.callId}
          userName={myName}
          directCallId={session.callId}
          roomName={session.roomName}
        />
      )}

      <CallRecapSheet
        open={!!recapId}
        onOpenChange={(o) => !o && setRecapId(null)}
        transcriptId={recapId}
      />
    </div>
  );
};
