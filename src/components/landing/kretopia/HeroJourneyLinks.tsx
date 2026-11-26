import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, User, Wand2, type LucideIcon } from "lucide-react";

import { trackLandingCta } from "@/lib/landingFunnel";
import { HERO_JOURNEYS, type JourneyId } from "@/lib/heroJourneys";
import { cn } from "@/lib/utils";

const ICON: Record<JourneyId, LucideIcon> = { people: User, skills: Wand2, opportunities: Briefcase };

/**
 * The three journeys as three cards in one even row: an icon, "People → Passport" with the feature in its own colour, one line
 * saying what it is, and a short bar in that colour that lengthens on hover. Each card wears one stop of the logo gradient
 * (violet, magenta, orange). On a phone they shrink to icon and name so the row stays level. Plain links to existing routes
 * (see heroJourneys.ts); the corner, tokens and focus ring are the app's.
 */
export function HeroJourneyLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Start with" className={cn("w-full", className)}>
      <ul className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {HERO_JOURNEYS.map((journey) => {
          const Icon = ICON[journey.id];
          const accent = `var(${journey.accent})`;
          return (
            <li key={journey.id} className="min-w-0">
              <Link
                to={journey.to}
                style={{ ["--accent" as string]: accent } as CSSProperties}
                onClick={() => trackLandingCta(journey.analyticsId, "hero", { label: journey.label, destination: journey.feature })}
                className={cn(
                  "group relative flex h-full min-w-0 flex-col items-center gap-2 overflow-hidden rounded-[var(--k-hero-radius)] border border-border bg-card/60 px-2 py-3.5 text-center backdrop-blur-md sm:items-start sm:gap-2 sm:p-4 sm:text-left",
                  "transition-[transform,border-color,background-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-card/80 hover:shadow-[0_18px_40px_-22px_var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {/* A hairline of the card's colour along its top edge, brightening on hover. */}
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-40 transition-opacity duration-300 group-hover:opacity-100" style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }} />
                <Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" style={{ color: accent }} aria-hidden strokeWidth={1.8} />
                <span className="flex min-w-0 max-w-full items-center gap-1.5 text-sm font-semibold text-foreground sm:text-base">
                  <span className="truncate">{journey.label}</span>
                  <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 sm:block" aria-hidden />
                  <span className="hidden truncate sm:inline" style={{ color: accent }} aria-hidden>
                    {journey.feature}
                  </span>
                </span>
                <span className="hidden text-[13px] leading-snug text-muted-foreground sm:block">{journey.description}</span>
                <span aria-hidden className="mt-1 hidden h-[3px] w-10 rounded-full transition-[width] duration-300 group-hover:w-20 sm:block" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default HeroJourneyLinks;
