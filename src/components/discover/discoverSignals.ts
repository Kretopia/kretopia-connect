import { useEffect } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Briefcase, CalendarDays, Radio, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { fetchGigs, fetchLiveStages, fetchNearbyEvents } from "@/components/today/radar/radar.queries";
import type { WrappedSignal, WrappedSignalState } from "@/components/wrapped/WrappedSignals";

export type DiscoverLane = "people" | "opps" | "live" | "events";

const DAY = 86_400_000;

/** Creatives who joined this week: the same count Today's Radar shows, read from the same public-safe view. */
export async function fetchNewMembers(): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const { count, error } = await supabase
    .from("public_profiles_safe")
    .select("user_id", { count: "exact", head: true })
    .not("username", "is", null)
    .gte("created_at", weekAgo);
  if (error) throw error;
  return count ?? 0;
}

interface Reading {
  value: number;
  state: WrappedSignalState;
}

const readingOf = (q: UseQueryResult<unknown>, value: number | undefined): Reading => ({
  value: value ?? 0,
  state: q.data !== undefined ? "ready" : q.isError ? "error" : "loading",
});

/**
 * The numbers above Discover. Stages, events and gigs use Today's Radar fetchers and query keys, so the two
 * surfaces share one cache and can never disagree about what "a Stage live now" is. Gigs are scouted for a
 * signed-in person, so a guest has no such number and is not shown one.
 */
export function useDiscoverSignals(userId: string | undefined) {
  const queryClient = useQueryClient();

  const stages = useQuery({ queryKey: ["radar", "stages"], queryFn: fetchLiveStages, staleTime: 30_000, refetchInterval: 60_000 });
  const events = useQuery({ queryKey: ["radar", "events", null], queryFn: () => fetchNearbyEvents(null), staleTime: 2 * 60_000, refetchInterval: 5 * 60_000 });
  const gigs = useQuery({ queryKey: ["radar", "gigs", userId], queryFn: () => fetchGigs(userId!), enabled: !!userId, staleTime: 30_000, refetchInterval: 60_000 });
  const members = useQuery({ queryKey: ["discover", "new-members"], queryFn: fetchNewMembers, staleTime: 5 * 60_000 });

  // A Stage going on or off air changes the count at once instead of at the next poll.
  useEffect(() => {
    const channel = supabase
      .channel("discover-live-pulse")
      .on("postgres_changes", { event: "*", schema: "public", table: "sound_stages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["radar", "stages"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    signedIn: !!userId,
    people: readingOf(members, members.data),
    gigs: readingOf(gigs, gigs.data?.newCount),
    stages: readingOf(stages, stages.data?.count),
    events: readingOf(events, events.data?.weekCount),
  };
}

export interface DiscoverSignalInput {
  signedIn: boolean;
  people: Reading;
  gigs: Reading;
  stages: Reading;
  events: Reading;
  /** Each tile switches to the lane it counts. */
  onSelect: (lane: DiscoverLane) => void;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** One tile per lane, in the lane order, worded as Today's Radar words the same numbers. */
export function buildDiscoverSignals({ signedIn, people, gigs, stages, events, onSelect }: DiscoverSignalInput): WrappedSignal[] {
  const list: WrappedSignal[] = [
    { id: "people", icon: Users, ...people, label: plural(people.value, "creative joined", "creatives joined"), hint: "this week", onSelect: () => onSelect("people") },
  ];
  if (signedIn) {
    list.push({ id: "gigs", icon: Briefcase, ...gigs, label: plural(gigs.value, "new gig for you", "new gigs for you"), hint: "in the last 24 h", onSelect: () => onSelect("opps") });
  }
  list.push(
    {
      id: "stages",
      icon: Radio,
      ...stages,
      label: plural(stages.value, "Stage live now", "Stages live now"),
      hint: stages.value > 0 ? "Join the room" : "None right now",
      onSelect: () => onSelect("live"),
      hot: stages.state === "ready" && stages.value > 0,
    },
    { id: "events", icon: CalendarDays, ...events, label: plural(events.value, "event this week", "events this week"), hint: "on Kretopia", onSelect: () => onSelect("events") },
  );
  return list;
}
