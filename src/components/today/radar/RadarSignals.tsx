import { Briefcase, CalendarDays, Radio, Users, type LucideIcon } from "lucide-react";

import { WrappedSignals } from "@/components/wrapped/WrappedSignals";
import type { SignalState } from "./useRadar";

export interface Signal {
  id: "stages" | "gigs" | "events" | "people";
  value: number;
  state: SignalState;
  /** What the number counts, e.g. "Stages live now". */
  label: string;
  /** The window or the invitation under it, e.g. "in the last 24 h". */
  hint: string;
  href: string;
}

const ICON: Record<Signal["id"], LucideIcon> = {
  stages: Radio,
  gigs: Briefcase,
  events: CalendarDays,
  people: Users,
};

/**
 * The Radar's four live numbers, each a link to where it leads. The tile
 * itself is the shared WrappedSignals grid (Scout's top section uses the same
 * one); this only says which icon each Radar signal wears and that a live
 * Stage gets the pulsing mark.
 */
export function RadarSignals({ signals }: { signals: Signal[] }) {
  return (
    <WrappedSignals
      label="Live signals"
      signals={signals.map((s) => ({
        id: s.id,
        icon: ICON[s.id],
        value: s.value,
        state: s.state,
        label: s.label,
        hint: s.hint,
        href: s.href,
        hot: s.id === "stages" && s.state === "ready" && s.value > 0,
      }))}
    />
  );
}

export default RadarSignals;
