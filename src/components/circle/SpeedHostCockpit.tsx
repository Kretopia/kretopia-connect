import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Bell, PlayCircle, Users, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  sessionId: string;
  isLive: boolean;
  startsAt: string;
  rsvpCount: number;
  joinedCount: number;
  inRoomCount: number; // live participants (from Daily presence — passed in)
  onShare: () => void;
  onStartMatching: () => void;
}

/**
 * Host-only overlay that turns an empty stage into a useful cockpit:
 * RSVP roster, countdown, share button, ping no-shows, manual matcher kick.
 * Auto-collapses to a chip once ≥2 guests are in the room.
 */
export const SpeedHostCockpit = ({
  sessionId,
  isLive,
  startsAt,
  rsvpCount,
  joinedCount,
  inRoomCount,
  onShare,
  onStartMatching,
}: Props) => {
  const { toast } = useToast();
  const [pinging, setPinging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [avatars, setAvatars] = useState<{ id: string; full_name: string | null; avatar_url: string | null }[]>([]);
  const [now, setNow] = useState(Date.now());

  // Auto-collapse when room fills up
  useEffect(() => {
    if (inRoomCount >= 2 && !collapsed) setCollapsed(true);
  }, [inRoomCount, collapsed]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Load RSVP avatars
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("speed_session_rsvps")
        .select("user_id")
        .eq("session_id", sessionId)
        .limit(12);
      const ids = (data ?? []).map((r) => r.user_id);
      if (!ids.length) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", ids);
      setAvatars(
        (profs ?? []).map((p: any) => ({
          id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        })),
      );
    })().catch(() => {});
  }, [sessionId, joinedCount, rsvpCount]);

  const ping = async () => {
    setPinging(true);
    try {
      const { error } = await supabase.functions.invoke("notify-speed-pool-ping", {
        body: { session_id: sessionId },
      });
      if (error) throw error;
      toast({ title: "Pinged 🔔", description: "We nudged everyone who saved a spot." });
    } catch (e: any) {
      toast({ title: "Couldn't ping", description: e?.message, variant: "destructive" });
    } finally {
      setPinging(false);
    }
  };

  const startMs = new Date(startsAt).getTime();
  const diff = Math.round((startMs - now) / 1000);
  const sign = diff < 0 ? "+" : "−";
  const absMin = Math.floor(Math.abs(diff) / 60);
  const absSec = Math.abs(diff) % 60;
  const timeLabel = isLive
    ? `Live ${sign === "−" ? "in" : ""} ${absMin}:${absSec.toString().padStart(2, "0")}`
    : `Starts in ${absMin}:${absSec.toString().padStart(2, "0")}`;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-medium border border-white/15 shadow-lg"
      >
        <Users className="h-3 w-3" /> {inRoomCount} in room
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
    );
  }

  return (
    <div className="w-[min(360px,calc(100vw-24px))] rounded-2xl bg-black/80 backdrop-blur-sm border border-white/15 shadow-2xl text-white p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-white/60 font-bold">Host cockpit</p>
          <p className="text-sm font-bold leading-tight">{timeLabel}</p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center"
          aria-label="Collapse"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        <span className="px-2 py-0.5 rounded-full bg-white/10">{rsvpCount} saved</span>
        <span className="px-2 py-0.5 rounded-full bg-white/10">{joinedCount} ready</span>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{inRoomCount} in room</span>
      </div>

      {avatars.length > 0 && (
        <div className="flex items-center -space-x-1.5">
          {avatars.slice(0, 8).map((a) => (
            <img
              key={a.id}
              src={a.avatar_url ?? "/avatar-silhouette.svg"}
              alt={a.full_name ?? "Guest"}
              className="h-6 w-6 rounded-full border-2 border-black object-cover bg-white/10"
            />
          ))}
          {rsvpCount > 8 && (
            <span className="h-6 w-6 rounded-full border-2 border-black bg-white/10 text-[10px] flex items-center justify-center font-bold">
              +{rsvpCount - 8}
            </span>
          )}
        </div>
      )}

      <p className="text-[11px] text-white/70 leading-snug">
        {inRoomCount < 2
          ? "Need 2+ in the room to start matching. Share the link and ping the squad."
          : "You're rolling. Tap below to fire the first match round."}
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="lime" className="rounded-full h-8 text-[11px] gap-1" onClick={onShare}>
          <Share2 className="h-3 w-3" /> Share
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full h-8 text-[11px] gap-1 bg-white/15 text-white hover:bg-white/25 border-0"
          onClick={ping}
          disabled={pinging || rsvpCount === 0}
        >
          <Bell className="h-3 w-3" /> {pinging ? "Pinging…" : "Ping RSVPs"}
        </Button>
        {isLive && inRoomCount >= 2 && (
          <Button
            size="sm"
            variant="default"
            className="rounded-full h-8 text-[11px] gap-1 col-span-2"
            onClick={onStartMatching}
          >
            <PlayCircle className="h-3 w-3" /> Start matching now
          </Button>
        )}
      </div>
    </div>
  );
};
