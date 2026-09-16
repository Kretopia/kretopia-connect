import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { SPEED_VERTICALS, getVerticalMeta, type SpeedVertical } from "@/lib/speedVerticals";
import { CalendarClock, Video, Mic, Users, ArrowRight, Sparkles } from "lucide-react";
import { trackDeckEvent } from "@/lib/deckMetrics";

interface Row {
  id: string;
  title: string;
  theme: string | null;
  vertical: string;
  mode: "video" | "audio";
  starts_at: string;
  duration_min: number;
  slot_seconds: number;
  status: string;
}

export default function SpeedIndex() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [vertical, setVertical] = useState<SpeedVertical | "all">("all");

  useEffect(() => { trackDeckEvent("speed_index_viewed", "speed", {}); }, []);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const horizonHi = new Date(Date.now() + 21 * 24 * 60 * 60_000).toISOString();
      const horizonLo = new Date(Date.now() - 60 * 60_000).toISOString();
      const { data } = await supabase
        .from("speed_sessions")
        .select("id,title,theme,vertical,mode,starts_at,duration_min,slot_seconds,status")
        .in("status", ["scheduled", "live"])
        .gte("starts_at", horizonLo)
        .lte("starts_at", horizonHi)
        .order("starts_at", { ascending: true });
      if (cancelled) return;
      const list = (data ?? []) as Row[];
      setRows(list);
      // Best-effort RSVP counts (anon can read rsvps if policy allows; ignore errors).
      try {
        const ids = list.map((r) => r.id);
        if (ids.length) {
          const { data: r } = await supabase
            .from("speed_session_rsvps")
            .select("session_id")
            .in("session_id", ids);
          const c: Record<string, number> = {};
          (r ?? []).forEach((x: { session_id: string }) => {
            c[x.session_id] = (c[x.session_id] ?? 0) + 1;
          });
          if (!cancelled) setCounts(c);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })().catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() =>
    vertical === "all" ? rows : rows.filter((r) => r.vertical === vertical), [rows, vertical]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Speed Networking Nights — Meet 6+ Creators in 30 Minutes | Kretopia"
        description="Themed video speed-networking for the creator economy. Producers × Singers, Filmmakers, Content Creators and more. RSVP free and meet your next collab."
      />

      <header className="border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
          <Badge variant="secondary" className="mb-3">
            <Sparkles className="h-3 w-3 mr-1" /> Live weekly
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-serif tracking-tight">
            Speed Networking for Creatives
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            5–7 minutes face-to-face, then we rotate. Connect or save anyone you vibe with.
            Themed nights so you meet the right people on purpose.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" /> Video or audio</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Sweet spot 6–12 RSVPs</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Add to Google / Apple Calendar</span>
          </div>
        </div>
      </header>

      {/* Vertical filter */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <Chip active={vertical === "all"} onClick={() => setVertical("all")} label="All nights" emoji="✨" />
          {SPEED_VERTICALS.map((v) => (
            <Chip
              key={v.id}
              active={vertical === v.id}
              onClick={() => setVertical(v.id as SpeedVertical)}
              label={v.label}
              emoji={v.emoji}
            />
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading upcoming nights…</p>}
        {!loading && filtered.length === 0 && (
          <Card className="p-8 text-center">
            <p className="font-medium">No sessions on the calendar yet for this theme.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back soon — we run themed nights weekly.
            </p>
            <Button asChild className="mt-4">
              <Link to="/circle">Explore Circles</Link>
            </Button>
          </Card>
        )}
        {filtered.map((r) => {
          const meta = getVerticalMeta(r.vertical);
          const when = new Date(r.starts_at);
          const dateLabel = when.toLocaleString(undefined, {
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit",
          });
          const live = r.status === "live";
          return (
            <Link key={r.id} to={`/circle/speed/${r.id}`} className="block group" onClick={() => trackDeckEvent("speed_index_card_click", "speed", { session_id: r.id, vertical: r.vertical, status: r.status })}>
              <Card className="p-4 sm:p-5 hover:border-primary/60 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="text-3xl shrink-0" aria-hidden>{meta.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={live ? "default" : "secondary"} className="text-[10px]">
                        {live ? "● LIVE NOW" : meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        {r.mode === "video" ? <Video className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                        {r.mode}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {Math.round(r.slot_seconds / 60)} min per match · {r.duration_min} min total
                      </span>
                    </div>
                    <h2 className="mt-1 font-semibold truncate">{r.title}</h2>
                    {r.theme && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{r.theme}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> {dateLabel}
                      </span>
                      {counts[r.id] ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {counts[r.id]} saved spot{counts[r.id] === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                </div>
              </Card>
            </Link>
          );
        })}
      </main>

      <section className="max-w-5xl mx-auto px-4 pb-16 pt-6">
        <Card className="p-6 sm:p-8 text-center bg-muted/30">
          <h3 className="text-xl font-semibold">How it works</h3>
          <div className="grid sm:grid-cols-3 gap-4 mt-4 text-sm text-muted-foreground">
            <div><strong className="text-foreground">1. RSVP free.</strong> Save your spot in seconds.</div>
            <div><strong className="text-foreground">2. Fill your Passport.</strong> Better profile = smarter matches.</div>
            <div><strong className="text-foreground">3. Show up live.</strong> Hit "I'm here", we pair you. 5 min each. Connect or save.</div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Chip({ label, emoji, active, onClick }: { label: string; emoji: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full border text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-border hover:border-primary/50"
      }`}
    >
      <span className="mr-1" aria-hidden>{emoji}</span>
      {label}
    </button>
  );
}
