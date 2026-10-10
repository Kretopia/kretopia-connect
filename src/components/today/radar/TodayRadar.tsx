import { RefreshCw } from "lucide-react";

import { KretoScene } from "@/components/brand/KretoScene";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useInView } from "@/hooks/useInView";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import type { ProfileRow } from "../today.types";
import { RadarLead } from "./RadarLead";
import { RadarLive } from "./RadarLive";
import { RadarEvents, RadarGigs } from "./RadarLists";
import { RadarPeople } from "./RadarPeople";
import { RadarProposals } from "./RadarProposals";
import { RadarSignals, type Signal } from "./RadarSignals";
import { ageLabel, buildProposals } from "./radar.logic";
import { useRadar } from "./useRadar";

/** Thin L-shaped corner marks: the HUD feel, drawn with borders only (no filters, no images). */
function HudCorners() {
  const base = "pointer-events-none absolute h-3.5 w-3.5 border-[hsl(var(--energy)/0.55)]";
  return (
    <>
      <span aria-hidden className={cn(base, "left-2.5 top-2.5 rounded-tl-md border-l border-t")} />
      <span aria-hidden className={cn(base, "right-2.5 top-2.5 rounded-tr-md border-r border-t")} />
      <span aria-hidden className={cn(base, "bottom-2.5 left-2.5 rounded-bl-md border-b border-l")} />
      <span aria-hidden className={cn(base, "bottom-2.5 right-2.5 rounded-br-md border-b border-r")} />
    </>
  );
}

interface TodayRadarProps {
  userId: string | undefined;
  profile: ProfileRow | null | undefined;
}

/**
 * Today's Radar: what is happening around this person right now, in one panel.
 *
 * Live Stages, gigs Scout just found, events this week and new creatives as
 * four numbers that link to where they lead; their own next event; events and
 * gigs worth a look; real Passports to meet, each with the reason it is
 * suggested; and what Kreto can draft from any of it, for their review.
 *
 * Nothing is fetched until the panel is about to be seen. The live numbers
 * refresh every minute while the tab is open and visible, and the header says
 * exactly how old they are.
 */
export function TodayRadar({ userId, profile }: TodayRadarProps) {
  const [ref, inView] = useInView<HTMLElement>("400px");
  const radar = useRadar({ userId, profile, enabled: inView });
  const now = useNow(15_000);

  const { status } = radar;
  const settled = Object.values(status).every((s) => s !== "loading");
  const allFailed = Object.values(status).every((s) => s === "error");
  const country = profile?.location?.split(",").map((p) => p.trim()).filter(Boolean).slice(1).pop() ?? null;

  const signals: Signal[] = [
    {
      id: "stages",
      value: radar.liveCount,
      state: status.stages,
      label: radar.liveCount === 1 ? "Stage live now" : "Stages live now",
      hint: radar.liveCount > 0 ? "Join the room" : "None right now",
      href: "/circle?tab=stages",
    },
    { id: "gigs", value: radar.newGigs, state: status.gigs, label: radar.newGigs === 1 ? "new gig for you" : "new gigs for you", hint: "in the last 24 h", href: "/scout" },
    { id: "events", value: radar.weekCount, state: status.events, label: radar.weekCount === 1 ? "event this week" : "events this week", hint: country ? `in ${country}` : "on Kretopia", href: "/meetup" },
    { id: "people", value: radar.newMembers, state: status.people, label: radar.newMembers === 1 ? "creative joined" : "creatives joined", hint: "this week", href: "/passport" },
  ];

  const lead = radar.nextEvent ?? radar.nearbyEvents[0] ?? null;
  const proposals = buildProposals({
    person: radar.people[0] ?? null,
    event: lead ? { title: lead.title, start_time: lead.start_time } : null,
    gig: radar.gigs[0] ?? null,
  });
  const age = ageLabel(radar.updatedAt, now);

  return (
    <section
      ref={ref}
      aria-labelledby="today-radar-title"
      className="relative isolate overflow-hidden rounded-3xl border border-[hsl(var(--energy)/0.22)] bg-card p-4 sm:p-6"
    >
      {/* depth: a faint grid and one soft light from the top left, behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid-quadrille opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(60% 45% at 0% 0%, hsl(var(--energy) / 0.10), transparent 70%)" }}
      />
      <HudCorners />

      <div className="space-y-5 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Kretopia radar</p>
            <h2 id="today-radar-title" className="mt-1.5 text-xl font-bold leading-tight text-foreground sm:text-2xl">
              What's happening <span className="k-gradient-text">around you</span>
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative inline-flex h-2 w-2" aria-hidden>
                  {!allFailed && inView && <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--energy))] opacity-60 motion-safe:animate-ping" />}
                  <span className={cn("relative inline-flex h-2 w-2 rounded-full", allFailed ? "bg-muted-foreground" : "bg-[hsl(var(--energy))]")} />
                </span>
                {allFailed ? "Offline" : "Live"}
              </span>
              {age && !allFailed && <span>· updated {age}</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void radar.refresh()}
              disabled={radar.isFetching || !inView}
              aria-label="Refresh the radar"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.6)]"
            >
              {radar.isFetching ? <KretopiaSpinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            </button>
            <KretoScene scene="product-launch" className="hidden h-16 w-32 shrink-0 rounded-xl border border-border sm:block" />
          </div>
        </header>

        {allFailed ? (
          <p role="alert" className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Couldn't reach the radar. Check your connection and refresh.
          </p>
        ) : (
          <>
            <RadarSignals signals={signals} />
            <RadarLive stages={radar.stages} total={radar.liveCount} />

            <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
              <div className="space-y-5 lg:col-span-7">
                {status.nextEvent === "loading" ? (
                  <div className="h-44 animate-pulse rounded-2xl bg-muted/50" aria-busy="true" />
                ) : (
                  <RadarLead event={radar.nextEvent} />
                )}
                <RadarEvents events={radar.nearbyEvents} state={status.events} total={radar.nextEvent ? 1 : 0} />
              </div>
              <div className="lg:col-span-5">
                <RadarGigs gigs={radar.gigs} state={status.gigs} now={new Date(now)} />
              </div>
            </div>

            <RadarPeople people={radar.people} credits={radar.credits} state={status.people} />
            {settled && <RadarProposals proposals={proposals} />}
          </>
        )}
      </div>
    </section>
  );
}

export default TodayRadar;
