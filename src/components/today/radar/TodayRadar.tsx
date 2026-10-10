import { RefreshCw } from "lucide-react";

import { KretoScene } from "@/components/brand/KretoScene";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";
import { useInView } from "@/hooks/useInView";
import { useNow } from "@/hooks/useNow";
import type { ProfileRow } from "../today.types";
import { RadarLead } from "./RadarLead";
import { RadarLive } from "./RadarLive";
import { RadarEvents, RadarGigs } from "./RadarLists";
import { RadarPeople } from "./RadarPeople";
import { RadarProposals } from "./RadarProposals";
import { RadarSignals, type Signal } from "./RadarSignals";
import { ageLabel, buildProposals } from "./radar.logic";
import { useRadar } from "./useRadar";

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
 *
 * The frame, the status line and the signal grid are the shared Wrapped
 * primitives (Scout's top section wears the same ones).
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
    <WrappedShell
      sectionRef={ref}
      titleId="today-radar-title"
      eyebrow="Kretopia radar"
      title={
        <>
          What's happening <span className="k-gradient-text">around you</span>
        </>
      }
      status={
        <WrappedStatus
          active={!allFailed}
          pinging={!allFailed && inView}
          label={allFailed ? "Offline" : "Live"}
          detail={age && !allFailed ? <>· updated {age}</> : null}
        />
      }
      aside={
        <>
          <button
            type="button"
            onClick={() => void radar.refresh()}
            disabled={radar.isFetching || !inView}
            aria-label="Refresh the radar"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.6)]"
          >
            {radar.isFetching ? <KretopiaSpinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          </button>
          <KretoScene scene="talent-search" size="thumb" className="hidden h-16 w-32 shrink-0 rounded-xl border border-border sm:block" />
        </>
      }
    >
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
    </WrappedShell>
  );
}

export default TodayRadar;
