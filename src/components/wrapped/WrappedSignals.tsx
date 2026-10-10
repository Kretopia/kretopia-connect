import { Link } from "react-router-dom";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type WrappedSignalState = "loading" | "error" | "ready";

export interface WrappedSignal {
  id: string;
  icon: LucideIcon;
  value: number;
  state: WrappedSignalState;
  /** What the number counts, e.g. "Stages live now". */
  label: string;
  /** The window or the invitation under it, e.g. "in the last 24 h". Empty for none. */
  hint: string;
  /** Where it leads. Give this for a navigation… */
  href?: string;
  /** …or this for a switch that stays on the page (a tab). With neither, the tile is a plain figure. */
  onSelect?: () => void;
  /** A live thing: the icon gets a pulsing mark. */
  hot?: boolean;
}

interface WrappedSignalsProps {
  signals: WrappedSignal[];
  /** Accessible name of the list. */
  label?: string;
  /** Column classes; the default is Today's two-up, four-wide grid. */
  columnsClassName?: string;
  /** One short row per signal on a phone (value beside its label); from `sm` up the tile is the same as ever. */
  compactOnMobile?: boolean;
}

const tileClass =
  "group relative flex h-full min-h-[104px] flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--energy)/0.6)]";

const compactTileClass =
  "group relative flex h-full min-h-[64px] flex-row items-center gap-3 p-3 transition-colors hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--energy)/0.6)] sm:min-h-[104px] sm:flex-col sm:items-stretch sm:justify-between sm:p-4";

/**
 * A row of live numbers, each one a way into where it leads. A number is only
 * ever a count of rows that exist; while one loads it is a placeholder, and if
 * its read failed it says so instead of showing a zero that would mean
 * "nothing".
 */
export function WrappedSignals({ signals, label = "Live signals", columnsClassName = "grid-cols-2 lg:grid-cols-4", compactOnMobile = false }: WrappedSignalsProps) {
  return (
    <ul className={cn("grid gap-px overflow-hidden rounded-2xl border border-border bg-border", columnsClassName)} aria-label={label}>
      {signals.map((s) => {
        const Icon = s.icon;
        const hot = !!s.hot;
        const interactive = !!(s.onSelect || s.href);
        const hintText = s.state === "error" ? "Couldn't load" : s.hint;
        const body = (
          <>
            <span className="flex items-center justify-between text-muted-foreground">
              <span className="relative inline-flex">
                <Icon className={cn("h-4 w-4", hot && "text-[hsl(var(--energy))]")} aria-hidden />
                {hot && (
                  <span aria-hidden className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--energy))] motion-safe:animate-pulse" />
                )}
              </span>
              {interactive && (
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
              )}
            </span>
            <span className={compactOnMobile ? "flex min-w-0 flex-1 items-center gap-3 sm:block" : "block"}>
              {s.state === "loading" ? (
                <Skeleton className="h-8 w-12" />
              ) : s.state === "error" ? (
                <span className="block text-3xl font-semibold leading-none text-muted-foreground" title="Couldn't load this one">–</span>
              ) : (
                <span className="block text-3xl font-semibold leading-none tabular-nums text-foreground">{s.value}</span>
              )}
              {compactOnMobile ? (
                <span className="block min-w-0 sm:mt-1.5">
                  <span className="block text-xs font-medium text-foreground">{s.label}</span>
                  {hintText && <span className="block text-[11px] text-muted-foreground">{hintText}</span>}
                </span>
              ) : (
                <>
                  <span className="mt-1.5 block text-xs font-medium text-foreground">{s.label}</span>
                  {hintText && <span className="block text-[11px] text-muted-foreground">{hintText}</span>}
                </>
              )}
            </span>
          </>
        );
        return (
          <li key={s.id} className="bg-card">
            {s.onSelect ? (
              <button type="button" onClick={s.onSelect} className={cn(compactOnMobile ? compactTileClass : tileClass, "w-full text-left")}>
                {body}
              </button>
            ) : s.href ? (
              <Link to={s.href} className={compactOnMobile ? compactTileClass : tileClass}>
                {body}
              </Link>
            ) : (
              <div className={cn(compactOnMobile ? compactTileClass : tileClass, "hover:bg-transparent")}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default WrappedSignals;
