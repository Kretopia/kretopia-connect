import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Radio, Briefcase, Users, type LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
 * Four live numbers, each a link to where they lead. A number is only ever a
 * count of rows that exist; while one loads it is a placeholder, and if its
 * read failed it says so instead of showing a zero that would mean "nothing".
 */
export function RadarSignals({ signals }: { signals: Signal[] }) {
  return (
    <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4" aria-label="Live signals">
      {signals.map((s) => {
        const Icon = ICON[s.id];
        const hot = s.id === "stages" && s.state === "ready" && s.value > 0;
        return (
          <li key={s.id} className="bg-card">
            <Link
              to={s.href}
              className="group relative flex h-full min-h-[104px] flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--energy)/0.6)]"
            >
              <span className="flex items-center justify-between text-muted-foreground">
                <span className="relative inline-flex">
                  <Icon className={cn("h-4 w-4", hot && "text-[hsl(var(--energy))]")} aria-hidden />
                  {hot && (
                    <span aria-hidden className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--energy))] motion-safe:animate-pulse" />
                  )}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
              </span>
              <span className="block">
                {s.state === "loading" ? (
                  <Skeleton className="h-8 w-12" />
                ) : s.state === "error" ? (
                  <span className="block text-3xl font-semibold leading-none text-muted-foreground" title="Couldn't load this one">–</span>
                ) : (
                  <span className="block text-3xl font-semibold leading-none tabular-nums text-foreground">{s.value}</span>
                )}
                <span className="mt-1.5 block text-xs font-medium text-foreground">{s.label}</span>
                <span className="block text-[11px] text-muted-foreground">{s.state === "error" ? "Couldn't load" : s.hint}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default RadarSignals;
