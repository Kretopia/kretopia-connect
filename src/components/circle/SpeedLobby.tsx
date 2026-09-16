import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, Clock, Users, Lightbulb } from "lucide-react";

interface Props {
  sessionId: string;
  startsAt: string;
  theme: string | null;
  rsvpCount: number;
  isGroupMode: boolean;
}

// Light icebreaker prompts shown one at a time. No DB, no game state —
// keeps the lobby warm without a heavy build.
const PROMPTS = [
  "What's one project you're shipping this month?",
  "What's the last thing that creatively inspired you?",
  "Who would be your dream collaborator?",
  "Hot take: what's overrated in your craft right now?",
  "What's one tool/app you can't work without?",
  "Coffee or chaos — how do you start a session?",
  "Drop your IG / portfolio in the chat.",
  "One word that describes your work this year?",
];

type Rsvp = { user_id: string; full_name: string | null; avatar_url: string | null };

/**
 * Pre-live lobby. Shown ~15 min before a session starts (or any time the user
 * lands on a scheduled session within 30 min of start). Countdown + roster +
 * rotating warm-up prompt. Two Truths & a Lie can ride on top later.
 */
export const SpeedLobby = ({ sessionId, startsAt, theme, rsvpCount, isGroupMode }: Props) => {
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor((new Date(startsAt).getTime() - Date.now()) / 1000)));
  const [promptIdx, setPromptIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("speed_session_rsvps")
        .select("user_id, profiles:user_id (full_name, avatar_url)")
        .eq("session_id", sessionId)
        .limit(20);
      if (cancelled) return;
      const list: Rsvp[] = (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        full_name: r.profiles?.full_name ?? null,
        avatar_url: r.profiles?.avatar_url ?? null,
      }));
      setRsvps(list);
    })();
    return () => { cancelled = true; };
  }, [sessionId, rsvpCount]);

  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const countdown = secondsLeft <= 0 ? "Live any second…" : `${m}:${String(s).padStart(2, "0")}`;

  return (
    <Card className="border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> Lobby
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold">
            <Clock className="h-3.5 w-3.5" /> {countdown}
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold">
            {isGroupMode
              ? "Open group call starting soon"
              : "Speed pairs starting soon"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isGroupMode
              ? "Tonight runs as one shared room — everyone meets together."
              : "You'll meet a fresh creator every few minutes once we go live."}
          </p>
          {theme && <p className="text-xs text-muted-foreground mt-1">Vibe: {theme}</p>}
        </div>

        {rsvps.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Who's here ({rsvpCount})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rsvps.slice(0, 12).map((r) => (
                <Avatar key={r.user_id} className="h-8 w-8 ring-2 ring-background">
                  {r.avatar_url && <AvatarImage src={r.avatar_url} alt={r.full_name ?? ""} />}
                  <AvatarFallback className="text-[10px]">
                    {(r.full_name ?? "?").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {rsvpCount > 12 && (
                <div className="h-8 w-8 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">
                  +{rsvpCount - 12}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-dashed border-primary/30 bg-background/50 p-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3" /> Warm-up
          </p>
          <p className="text-sm">{PROMPTS[promptIdx]}</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => setPromptIdx((i) => (i + 1) % PROMPTS.length)}
          >
            Next prompt →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
