import { Link } from "react-router-dom";
import { Briefcase, User, Wand2, type LucideIcon } from "lucide-react";

import { trackLandingCta } from "@/lib/landingFunnel";
import { HERO_JOURNEYS, type JourneyId } from "@/lib/heroJourneys";
import { cn } from "@/lib/utils";

const ICON: Record<JourneyId, LucideIcon> = { people: User, skills: Wand2, opportunities: Briefcase };

/**
 * The three journeys, as quiet chips under the search: People, Skills, Opportunities. Plain links to existing routes (see
 * heroJourneys.ts), styled with the app's tokens and corner, with a small lift on hover and a visible focus ring.
 */
export function HeroJourneyLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Start with" className={cn("w-full", className)}>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {HERO_JOURNEYS.map((journey) => {
          const Icon = ICON[journey.id];
          return (
            <li key={journey.id} className="min-w-0">
              <Link
                to={journey.to}
                onClick={() => trackLandingCta(journey.analyticsId, "hero", { label: journey.label, destination: journey.feature })}
                className={cn(
                  "group flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--k-hero-radius)] border border-border bg-card/60 px-2 py-3 text-center backdrop-blur-sm sm:flex-row sm:gap-2.5 sm:px-4",
                  "transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/35 hover:bg-card/80 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-foreground/70 transition-colors group-hover:text-foreground" aria-hidden />
                <span className="min-w-0 truncate text-sm font-semibold text-foreground">{journey.label}</span>
                <span className="hidden truncate text-[11px] text-muted-foreground sm:inline" aria-hidden>
                  {journey.feature}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default HeroJourneyLinks;
