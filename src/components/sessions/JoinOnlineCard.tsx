import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Loader2, Lock, Clock, Radio, CheckCircle2, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import {
  type EventMode,
  type OnlineFormat,
  getFormatConfig,
  formatCapacityLine,
} from "@/lib/eventFormats";

interface Props {
  eventId: string;
  eventTitle: string;
  startTime: string; // ISO
  eventMode: EventMode;
  onlineFormat: OnlineFormat | null;
  onlineMaxAttendees: number | null;
  watchPartyVideoUrl: string | null;
  recordingEnabled: boolean;
  videoRoomStartedAt: string | null;
  /** True when the viewer holds an RSVP or paid ticket (or is the host). */
  hasAccess: boolean;
  /** True when the viewer can sign up — used to nudge them toward RSVP. */
  needsRsvp: boolean;
  /** True when viewer is the event owner or a co-host — unlocks Soundcheck. */
  isHost?: boolean;
}

const JOIN_WINDOW_MIN = 15; // minutes before start_time the room unlocks

export const JoinOnlineCard = ({
  eventId,
  eventTitle,
  startTime,
  eventMode,
  onlineFormat,
  onlineMaxAttendees,
  watchPartyVideoUrl,
  recordingEnabled,
  videoRoomStartedAt,
  hasAccess,
  needsRsvp,
  isHost = false,
}: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [starting, setStarting] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [room, setRoom] = useState<{ url: string; name: string; token: string } | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  if (eventMode === "irl" || !onlineFormat) return null;

  const cfg = getFormatConfig(onlineFormat);
  if (!cfg) return null;

  const startMs = new Date(startTime).getTime();
  const minsToStart = Math.round((startMs - now) / 60_000);
  const roomLive = !!videoRoomStartedAt;
  const unlocksAt = startMs - JOIN_WINDOW_MIN * 60_000;
  const canJoinNow = now >= unlocksAt || roomLive;

  const myName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest";

  const handleJoin = async (test = false) => {
    if (!user) {
      toast({ title: "Sign in to join", description: "Free 1-tap signup gets you in." });
      return;
    }
    if (!test && !hasAccess) {
      toast({
        title: needsRsvp ? "Save your spot first" : "Ticket required",
        description: "Then come back here to join the room.",
      });
      return;
    }
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-event-room", {
        body: { event_id: eventId, user_name: myName, ...(test ? { mode: "test" } : {}) },
      });
      if (error) throw error;
      if (!data?.room_url || !data?.token) throw new Error("No room returned");
      setRoom({ url: data.room_url, name: data.room_name, token: data.token });
      setCallOpen(true);
      if (test) {
        toast({
          title: "Soundcheck room opened",
          description: "Private to you — guests won't see this as live.",
        });
      }
    } catch (e: any) {
      console.error("[JoinOnlineCard] start failed", e);
      toast({
        title: "Couldn't open the room",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  };

  const renderCta = () => {
    if (!hasAccess) {
      return (
        <Button variant="outline" disabled className="w-full gap-2">
          <Lock className="h-4 w-4" />
          {needsRsvp ? "Save your spot to unlock" : "Ticket required"}
        </Button>
      );
    }
    if (!canJoinNow) {
      const hours = Math.floor(minsToStart / 60);
      const label =
        minsToStart > 60
          ? `Opens in ${hours}h ${minsToStart - hours * 60}m`
          : `Opens ${minsToStart} min before start`;
      return (
        <Button variant="outline" disabled className="w-full gap-2">
          <Clock className="h-4 w-4" />
          {label}
        </Button>
      );
    }
    return (
      <Button
        variant="gradient"
        className="w-full gap-2 py-6 text-base"
        onClick={() => handleJoin(false)}
        disabled={starting}
      >
        {starting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Video className="h-5 w-5" />
            {roomLive ? "Join the room" : "Open the room"}
          </>
        )}
      </Button>
    );
  };

  return (
    <>
      <Card className="mb-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              {(() => { const Icon = cfg.icon; return <Icon className="h-5 w-5" />; })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-base leading-tight">
                  {eventMode === "hybrid" ? "Online attendance" : "Live online"}
                </p>
                {roomLive && (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                    <Radio className="h-3 w-3 animate-pulse" /> Live now
                  </Badge>
                )}
                {recordingEnabled && (
                  <Badge variant="secondary" className="text-[10px]">
                    Recorded
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCapacityLine(onlineFormat, onlineMaxAttendees)}
              </p>
              <p className="text-[11px] text-muted-foreground/90 mt-1.5 leading-snug">
                {cfg.description}
              </p>
            </div>
          </div>

          {onlineFormat === "watch_party" && watchPartyVideoUrl && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Tonight's pick: </span>
              <span className="truncate">{watchPartyVideoUrl}</span>
            </div>
          )}

          {hasAccess && canJoinNow && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              You're in. Tap below when you're ready.
            </div>
          )}

          {renderCta()}

          {isHost && (
            <div className="pt-1 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleJoin(true)}
                disabled={starting}
              >
                <Headphones className="h-3.5 w-3.5" />
                Soundcheck — test cam, mic & screenshare (private to you)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {room && (
        <VideoCallSheet
          open={callOpen}
          onOpenChange={(o) => {
            setCallOpen(o);
            if (!o) setRoom(null);
          }}
          projectName={eventTitle}
          roomUrl={room.url}
          roomName={room.name}
          token={room.token}
          callId={null}
          userName={myName}
          userAvatar={user?.user_metadata?.avatar_url ?? null}
        />
      )}
    </>
  );
};
