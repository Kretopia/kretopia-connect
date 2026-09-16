import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CalendarDays, Users, ArrowRight, Radio } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

type Sess = {
  id: string;
  title: string;
  theme: string | null;
  starts_at: string;
  status: string;
  fallback_mode: string | null;
  rsvp_count?: number;
};

/**
 * Home/Today surface card. Shows the next Speed Session the user RSVP'd to,
 * OR the nearest open scheduled session within 36h. Hides when nothing fits.
 */
export const SpeedTonightCard = () => {
  const { user } = useAuth();
  const [sess, setSess] = useState<(Sess & { mine: boolean }) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const horizon = new Date(Date.now() + 36 * 3_600_000).toISOString();

      // Prefer one I RSVP'd to
      if (user) {
        const { data: rsvps } = await supabase
          .from("speed_session_rsvps")
          .select("session_id, speed_sessions!inner (id, title, theme, starts_at, status, fallback_mode)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);
        const mine = (rsvps ?? [])
          .map((r: any) => r.speed_sessions)
          .filter((s: any) => s && (s.status === "scheduled" || s.status === "live") && s.starts_at <= horizon)
          .sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
        if (mine) {
          if (!cancelled) setSess({ ...(mine as any), mine: true });
          return;
        }
      }

      // Otherwise, nearest open scheduled night
      const { data: open } = await supabase
        .from("speed_sessions")
        .select("id, title, theme, starts_at, status, fallback_mode")
        .in("status", ["scheduled", "live"])
        .lte("starts_at", horizon)
        .gte("starts_at", new Date(Date.now() - 30 * 60_000).toISOString())
        .order("starts_at", { ascending: true })
        .limit(1);
      if (!cancelled && open && open.length > 0) setSess({ ...(open[0] as any), mine: false });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  if (!sess) return null;

  const isLive = sess.status === "live";
  const startsAt = new Date(sess.starts_at);
  const inWords = isLive
    ? "Live now"
    : `In ${formatDistanceToNowStrict(startsAt)}`;
  const isGroupMode = sess.fallback_mode === "group";

  return (
    <Link to={`/circle/speed/${sess.id}`} className="block">
      <div className={cn("rounded-2xl glass-surface p-4 flex items-center gap-3 transition-colors hover:border-[hsl(var(--color-accent)_/_0.4)]")}>
        <div className="h-11 w-11 shrink-0 rounded-xl bg-[hsl(var(--color-accent)_/_0.15)] text-[hsl(var(--color-accent))] flex items-center justify-center">
          {isLive ? <Radio className="h-5 w-5 animate-pulse" /> : <CalendarDays className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--color-accent))] truncate">
              {isLive ? "Speed Session · LIVE" : sess.mine ? "Your Speed Session" : "Speed Session tonight"}
            </p>
            {isGroupMode && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">
                Group
              </span>
            )}
          </div>
          <p className="text-sm font-semibold truncate">{sess.title}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Users className="h-3 w-3" /> {inWords}
            {sess.theme && <span className="truncate">· {sess.theme}</span>}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
};
