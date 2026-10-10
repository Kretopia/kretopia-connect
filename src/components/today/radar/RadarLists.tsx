import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { formatDistance } from "date-fns";

import { MediaImage } from "@/components/media/MediaImage";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEventWhen } from "@/lib/nextEvent";
import { hasRealCompensation } from "@/lib/scoutPay";
import { startsIn, type NearbyEvent, type RadarGig } from "./radar.logic";
import type { SignalState } from "./useRadar";

function ListHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      <Link to={href} className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.6)]">
        {linkLabel} <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

const rowClass =
  "group flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:border-[hsl(var(--energy)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.6)]";

/* ───────────── events near you ───────────── */

export function RadarEvents({ events, state, total }: { events: NearbyEvent[]; state: SignalState; total: number }) {
  return (
    <section aria-label="Events near you">
      <ListHeader title="Events near you" href="/meetup" linkLabel="All events" />
      {state === "loading" ? (
        <RowSkeleton />
      ) : state === "error" ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Couldn't load events right now.</p>
      ) : events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          No public events in the next two weeks{total === 0 ? "" : " besides yours"}. Hosting one puts you on everyone's radar.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const soon = startsIn(e.start_time);
            return (
              <li key={e.id}>
                <Link to={`/event/${e.id}`} className={rowClass}>
                  <MediaImage
                    src={e.cover_image_url}
                    alt=""
                    aspect="aspect-square"
                    className="h-11 w-11 shrink-0 rounded-lg"
                    fallback={
                      <span className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                        <CalendarDays className="h-4 w-4" aria-hidden />
                      </span>
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{e.title}</span>
                    <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
                      {formatEventWhen(e.start_time)}
                      {e.venue_name && (
                        <>
                          <span aria-hidden>·</span>
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">{e.venue_name}</span>
                        </>
                      )}
                    </span>
                  </span>
                  {soon && <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{soon}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ───────────── gigs Scout found for me ───────────── */

const ago = (iso: string | null, now: Date) =>
  iso && Number.isFinite(Date.parse(iso)) ? formatDistance(new Date(Math.min(Date.parse(iso), now.getTime())), now, { addSuffix: true }).replace("about ", "") : null;

export function RadarGigs({ gigs, state, now = new Date() }: { gigs: RadarGig[]; state: SignalState; now?: Date }) {
  return (
    <section aria-label="Gigs for you">
      <ListHeader title="Gigs for you" href="/scout" linkLabel="Open Scout" />
      {state === "loading" ? (
        <RowSkeleton />
      ) : state === "error" ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Couldn't load your gigs right now.</p>
      ) : gigs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Scout hasn't found a fit yet. It keeps looking while Today is open.
        </p>
      ) : (
        <ul className="space-y-2">
          {gigs.map((g) => {
            const when = g.posted_at ? `Posted ${ago(g.posted_at, now)}` : `Found ${ago(g.scouted_at, now)}`;
            const pay = hasRealCompensation(g.compensation) ? g.compensation : null;
            return (
              <li key={g.id}>
                <Link to="/scout" className={rowClass} aria-label={`${g.title}, ${Math.round(g.fit_score)}% fit. Open Scout.`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{g.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[g.company, g.remote ? "Remote" : g.location, pay, when].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-[hsl(var(--energy)/0.4)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground">
                    {Math.round(g.fit_score)}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
