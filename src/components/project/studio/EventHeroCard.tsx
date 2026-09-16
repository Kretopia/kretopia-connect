import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, MapPin, Users, ExternalLink, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findArchetype } from "@/lib/eventArchetypes";

interface Props {
  project: any;
}

interface EventLite {
  id: string;
  title: string;
  start_time: string;
  venue_name: string | null;
  venue_address: string | null;
  cover_image_url: string | null;
  max_participants: number | null;
  category: string | null;
}

function useCountdown(target?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [target]);
  return useMemo(() => {
    if (!target) return null;
    const ms = new Date(target).getTime() - now;
    if (Number.isNaN(ms)) return null;
    const past = ms < 0;
    const abs = Math.abs(ms);
    const days = Math.floor(abs / 86_400_000);
    const hours = Math.floor((abs % 86_400_000) / 3_600_000);
    const mins = Math.floor((abs % 3_600_000) / 60_000);
    return { past, days, hours, mins };
  }, [target, now]);
}

/**
 * Renders only when the Studio is linked to a creative_jam (event_id present).
 * Shows countdown, RSVP count, venue, and quick links to the public event page.
 */
export function EventHeroCard({ project }: Props) {
  const eventId = project?.event_id as string | null;
  const [event, setEvent] = useState<EventLite | null>(null);
  const [rsvpCount, setRsvpCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: ev }, { count }] = await Promise.all([
        supabase
          .from("creative_jams")
          .select("id, title, start_time, venue_name, venue_address, cover_image_url, max_participants, category")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("jam_participants" as any)
          .select("id", { count: "exact", head: true })
          .eq("jam_id", eventId)
          .in("status", ["confirmed", "going", "attending"] as any),
      ]).catch(() => [{ data: null }, { count: 0 }] as any);
      if (cancelled) return;
      setEvent((ev as EventLite) || null);
      setRsvpCount(count ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const arch = findArchetype(project?.mood);
  const cd = useCountdown(event?.start_time);

  if (!eventId || loading || !event) return null;

  const dateLabel = new Date(event.start_time).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = new Date(event.start_time).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const cdLabel = cd
    ? cd.past
      ? "Event in progress / wrapped"
      : cd.days >= 1
        ? `${cd.days}d ${cd.hours}h to go`
        : cd.hours >= 1
          ? `${cd.hours}h ${cd.mins}m to go`
          : `${cd.mins}m to go`
    : null;

  return (
    <section className="px-4 lg:px-0 pt-4">
      <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--energy)/0.35)] bg-gradient-to-br from-[hsl(var(--energy)/0.12)] via-primary/5 to-transparent p-4">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-10 h-40 w-40 rounded-full bg-[hsl(var(--energy)/0.35)] blur-3xl opacity-40"
        />
        <div className="relative flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-[hsl(var(--energy)/0.18)] ring-1 ring-[hsl(var(--energy)/0.4)] flex items-center justify-center shrink-0">
            {arch ? (
              <arch.icon className="h-5 w-5 text-[hsl(var(--energy))]" />
            ) : (
              <Calendar className="h-5 w-5 text-[hsl(var(--energy))]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
              {arch?.label ?? "Live Event"}
            </p>
            <h2 className="text-base font-black leading-tight tracking-tight truncate">
              {event.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {dateLabel}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeLabel}
              </span>
              {event.venue_name && (
                <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                  <MapPin className="h-3 w-3" />
                  {event.venue_name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-background/50 ring-1 ring-border/40 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Countdown
            </p>
            <p className="text-sm font-black tracking-tight mt-0.5">
              {cdLabel ?? "—"}
            </p>
          </div>
          <div className="rounded-xl bg-background/50 ring-1 ring-border/40 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              RSVPs
            </p>
            <p className="text-sm font-black tracking-tight mt-0.5 inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[hsl(var(--energy))]" />
              {rsvpCount ?? 0}
              {event.max_participants ? (
                <span className="text-[11px] font-normal text-muted-foreground">
                  / {event.max_participants}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="relative mt-3 flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 text-[11px]">
            <Link to={`/events/${event.id}`}>
              <ExternalLink className="h-3 w-3 mr-1" /> Public page
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-[11px]"
            onClick={() => {
              const url = `${window.location.origin}/events/${event.id}`;
              if (navigator.share) {
                navigator.share({ title: event.title, url }).catch(() => {});
              } else {
                navigator.clipboard.writeText(url).catch(() => {});
              }
            }}
          >
            <Share2 className="h-3 w-3 mr-1" /> Share
          </Button>
          {event.category && (
            <Badge variant="secondary" className="ml-auto text-[10px] uppercase tracking-wider">
              {event.category}
            </Badge>
          )}
        </div>
      </div>
    </section>
  );
}
