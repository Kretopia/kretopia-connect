import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { skillNames } from "@/lib/skillNames";
import type { ProfileRow } from "../today.types";
import {
  countryOf,
  pickNearbyEvents,
  rankPeopleToMeet,
  type Me,
} from "./radar.logic";
import {
  fetchCredits,
  fetchGigs,
  fetchLiveStages,
  fetchNearbyEvents,
  fetchNextEvent,
  fetchPeople,
} from "./radar.queries";

export type SignalState = "loading" | "error" | "ready";

const state = (q: UseQueryResult<unknown>): SignalState => (q.data !== undefined ? "ready" : q.isError ? "error" : "loading");

interface UseRadarInput {
  userId: string | undefined;
  profile: ProfileRow | null | undefined;
  /** False until the Radar is about to be seen: nothing is fetched before that. */
  enabled: boolean;
}

/**
 * All the Radar's data, as independent cached queries so one failing read
 * never blanks the rest. What changes by the minute (live Stages, gigs found
 * for me) refreshes every 60 s; what changes by the hour (events, people)
 * every 5 min. react-query only polls while the tab is visible and refetches
 * on focus, so a tab left open in the background costs nothing.
 */
export function useRadar({ userId, profile, enabled }: UseRadarInput) {
  const on = !!userId && enabled;
  const location = profile?.location ?? null;
  const country = countryOf(location);
  const role = profile?.role ?? null;
  const professional = (profile as { professional_skills?: unknown } | null | undefined)?.professional_skills;
  const passion = (profile as { passion_skills?: unknown } | null | undefined)?.passion_skills;

  const me: Me = useMemo(
    () => ({ role, location, skills: [...new Set([...skillNames(professional), ...skillNames(passion)])] }),
    [role, location, professional, passion],
  );

  const live = { enabled: on, staleTime: 30_000, refetchInterval: 60_000 } as const;
  const steady = { enabled: on, staleTime: 2 * 60_000, refetchInterval: 5 * 60_000 } as const;

  const nextEvent = useQuery({ queryKey: ["radar", "next-event", userId], queryFn: () => fetchNextEvent(userId!), ...steady });
  const nearby = useQuery({ queryKey: ["radar", "events", country], queryFn: () => fetchNearbyEvents(country), ...steady });
  const gigs = useQuery({ queryKey: ["radar", "gigs", userId], queryFn: () => fetchGigs(userId!), ...live });
  const stages = useQuery({ queryKey: ["radar", "stages"], queryFn: fetchLiveStages, ...live });
  const peopleRaw = useQuery({ queryKey: ["radar", "people", userId], queryFn: () => fetchPeople(userId!), ...steady });

  const people = useMemo(() => {
    if (!peopleRaw.data || !userId) return [];
    return rankPeopleToMeet(me, peopleRaw.data.rows, new Set([userId, ...peopleRaw.data.knownIds]));
  }, [peopleRaw.data, me, userId]);

  const creditIds = useMemo(() => people.map((p) => p.person.user_id), [people]);
  const credits = useQuery({
    queryKey: ["radar", "credits", creditIds.join(",")],
    queryFn: () => fetchCredits(creditIds),
    enabled: on && creditIds.length > 0,
    staleTime: 10 * 60_000,
  });

  const mine = nextEvent.data ?? null;
  const nearbyRows = nearby.data?.rows;
  const nearbyEvents = useMemo(() => pickNearbyEvents(nearbyRows ?? [], mine), [nearbyRows, mine]);

  const queries = [nextEvent, nearby, gigs, stages, peopleRaw] as const;
  const updatedAt = Math.max(0, ...queries.map((q) => q.dataUpdatedAt));
  const isFetching = queries.some((q) => q.isFetching);
  const refresh = () => Promise.all(queries.map((q) => q.refetch()));

  return {
    me,
    nextEvent: mine,
    nearbyEvents,
    weekCount: nearby.data?.weekCount ?? 0,
    gigs: gigs.data?.top ?? [],
    newGigs: gigs.data?.newCount ?? 0,
    stages: stages.data?.rows ?? [],
    liveCount: stages.data?.count ?? 0,
    people,
    newMembers: peopleRaw.data?.newThisWeek ?? 0,
    credits: credits.data ?? {},
    status: {
      nextEvent: state(nextEvent),
      events: state(nearby),
      gigs: state(gigs),
      stages: state(stages),
      people: state(peopleRaw),
    },
    updatedAt: updatedAt || null,
    isFetching,
    refresh,
  };
}

export type RadarData = ReturnType<typeof useRadar>;
