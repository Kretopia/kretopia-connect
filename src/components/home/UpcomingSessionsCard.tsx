import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Radio, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpcomingItem {
  id: string;
  kind: "speed_host" | "speed_rsvp";
  title: string;
  starts_at: string;
  vertical?: string | null;
}

/**
 * "Your upcoming sessions" — surfaces Speed Sessions the signed-in user
 * is hosting OR has RSVP'd to within the next 14 days. Renders nothing
 * when there's nothing on the calendar (keeps Today clean).
 */
export function UpcomingSessionsCard() {
  const { user } = useAuth();
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const horizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const hostedP = supabase
        .from("speed_sessions")
        .select("id, title, starts_at, vertical, status")
        .eq("host_user_id", user.id)
        .gte("starts_at", nowIso)
        .lte("starts_at", horizon)
        .neq("status", "ended")
        .order("starts_at", { ascending: true })
        .then((r) => r.data ?? [], () => []);

      const rsvpsP = supabase
        .from("speed_session_rsvps")
        .select("session_id, speed_sessions!inner(id, title, starts_at, vertical, status, host_user_id)")
        .eq("user_id", user.id)
        .then((r: any) => r.data ?? [], () => []);

      const [hosted, rsvps] = await Promise.all([hostedP, rsvpsP]);
      if (cancelled) return;

      const map = new Map<string, UpcomingItem>();
      hosted.forEach((s: any) => {
        map.set(s.id, { id: s.id, kind: "speed_host", title: s.title, starts_at: s.starts_at, vertical: s.vertical });
      });
      rsvps.forEach((r: any) => {
        const s = r.speed_sessions;
        if (!s || s.status === "ended") return;
        if (s.host_user_id === user.id) return; // already in hosted
        const starts = new Date(s.starts_at).getTime();
        if (starts < Date.now() || starts > Date.now() + 14 * 24 * 60 * 60 * 1000) return;
        if (!map.has(s.id)) {
          map.set(s.id, { id: s.id, kind: "speed_rsvp", title: s.title, starts_at: s.starts_at, vertical: s.vertical });
        }
      });

      const sorted = [...map.values()].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
      setItems(sorted.slice(0, 3));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading || items.length === 0) return null;

  return (
    <div className="mt-2 mb-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Your upcoming sessions
        </p>
        <Link to="/circle/speed" className="text-[11px] font-semibold text-primary hover:underline">
          Browse all
        </Link>
      </div>
      <div className="space-y-2">
        {items.map((it) => {
          const d = new Date(it.starts_at);
          const when = d.toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit",
          });
          const isHost = it.kind === "speed_host";
          return (
            <Link
              key={it.id}
              to={`/circle/speed/${it.id}`}
              className={cn(
                "block rounded-2xl border border-border bg-card px-4 py-3",
                "hover:border-primary/40 transition-colors",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                  isHost ? "bg-energy/15 text-energy" : "bg-primary/10 text-primary",
                )}>
                  {isHost ? <Radio className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {isHost ? "You're hosting" : "You're in"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{it.title}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <CalendarClock className="h-3 w-3" />
                    {when}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
