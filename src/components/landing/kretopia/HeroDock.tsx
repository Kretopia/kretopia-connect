import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Briefcase, User, Wand2, type LucideIcon } from "lucide-react";

import { trackLandingCta } from "@/lib/landingFunnel";
import { HERO_JOURNEYS, HERO_SECONDARY_CTAS, type JourneyId } from "@/lib/heroJourneys";
import { cn } from "@/lib/utils";

const ICON: Record<JourneyId, LucideIcon> = { people: User, skills: Wand2, opportunities: Briefcase };

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/60";

/**
 * The hero's one block under the search: the three journeys on top, the three actions underneath, in a single glass panel with
 * one edge, one corner and the same three columns, so each action sits under a journey and nothing floats on its own. A hairline
 * in all four colours of the logo gradient crowns it; each journey wears one stop of that gradient (violet, magenta, orange) and
 * lights its cell from the top on hover, and the first action ("Explore Kretopia") is the panel's filled tab in the logo's
 * colours. Plain links to existing routes (see heroJourneys.ts). While a journey is hovered or focused the hero is told
 * (`onActiveChange`), so the horizon above the planet can take its colour.
 */
export function HeroDock({ onActiveChange, className }: { onActiveChange?: (id: JourneyId | null) => void; className?: string }) {
  return (
    <div
      data-hero-dock
      className={cn(
        "relative w-full overflow-hidden rounded-[var(--k-hero-radius)] border border-border bg-card/55 text-left shadow-[0_30px_80px_-40px_rgba(64,18,248,0.55)] backdrop-blur-xl",
        className,
      )}
    >
      {/* The crown: the logo's own gradient as a hairline along the top edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px opacity-80"
        style={{ background: "linear-gradient(90deg, var(--k-g-1), var(--k-g-2) 35%, var(--k-g-3) 65%, var(--k-g-4))" }}
      />

      <nav aria-label="Start with">
        <ul className="grid grid-cols-3 divide-x divide-border/70">
          {HERO_JOURNEYS.map((journey) => {
            const Icon = ICON[journey.id];
            const accent = `var(${journey.accent})`;
            return (
              <li
                key={journey.id}
                className="min-w-0"
                onMouseEnter={() => onActiveChange?.(journey.id)}
                onMouseLeave={() => onActiveChange?.(null)}
                onFocus={() => onActiveChange?.(journey.id)}
                onBlur={() => onActiveChange?.(null)}
              >
                <Link
                  to={journey.to}
                  style={{ ["--accent" as string]: accent } as CSSProperties}
                  onClick={() => trackLandingCta(journey.analyticsId, "hero", { label: journey.label, destination: journey.feature })}
                  className={cn(
                    "group relative flex h-full min-w-0 flex-col items-center gap-1.5 px-2 py-3 text-center sm:items-start sm:gap-2.5 sm:px-5 sm:py-5 sm:text-left",
                    "transition-colors duration-300",
                    FOCUS,
                  )}
                >
                  {/* The cell lights from the top in its own colour. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
                    style={{ background: "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 72%)" }}
                  />
                  <span className="relative flex w-full items-center justify-center sm:justify-between">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:h-10 sm:w-10"
                      style={{ color: accent, borderColor: "color-mix(in srgb, var(--accent) 38%, transparent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                    >
                      <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden strokeWidth={1.8} />
                    </span>
                    <ArrowUpRight
                      className="hidden h-4 w-4 text-muted-foreground opacity-60 transition-[transform,opacity,color] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--accent)] motion-reduce:transition-none sm:block"
                      aria-hidden
                    />
                  </span>
                  <span className="relative flex min-w-0 max-w-full flex-col gap-0.5 sm:gap-1">
                    <span className="truncate text-sm font-semibold text-foreground sm:text-base">{journey.label}</span>
                    <span className="hidden truncate text-[11px] font-semibold uppercase tracking-[0.16em] sm:block" style={{ color: accent }} aria-hidden>
                      {journey.feature}
                    </span>
                  </span>
                  <span className="relative hidden text-[13px] leading-snug text-muted-foreground sm:block">{journey.description}</span>
                  {/* One more stop of the gradient, growing as the cell is used. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
                    style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="grid grid-cols-2 border-t border-border/70 sm:grid-cols-3">
        {HERO_SECONDARY_CTAS.map((cta, i) => {
          const primary = i === 0;
          return (
            <Link
              key={cta.analyticsId}
              to={cta.to}
              data-cta={primary ? "primary" : "secondary"}
              // The filled tab is white on the logo gradient in both themes; set inline so Daylight's text remap cannot turn it dark.
              style={primary ? { color: "#fff" } : undefined}
              onClick={() => trackLandingCta(cta.analyticsId, "hero", { label: cta.label, variant: "kreto_universe" })}
              className={cn(
                "group relative flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-[0.8125rem] font-semibold transition-[background-color,color,filter] duration-300 sm:min-h-14 sm:gap-2 sm:px-6 sm:text-sm",
                primary
                  ? "col-span-2 border-b border-border/70 [background:linear-gradient(100deg,var(--k-g-1),var(--k-g-2)_52%,var(--k-g-3))] hover:brightness-110 sm:col-span-1 sm:border-b-0"
                  : cn("text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground", i === 2 ? "border-l border-border/70" : "sm:border-l sm:border-border/70"),
                FOCUS,
              )}
            >
              {primary ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: "linear-gradient(100deg, transparent 20%, rgba(255,167,34,0.55))" }}
                />
              ) : null}
              <span className="relative">{cta.label}</span>
              <ArrowUpRight className="relative h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0" aria-hidden />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default HeroDock;
