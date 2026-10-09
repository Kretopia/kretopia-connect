import type { ReactNode } from "react";

import { HoloCard } from "@/components/passport/HoloCard";
import { cn } from "@/lib/utils";

interface TodayCardProps {
  /** Accessible name of the card's region. */
  label: string;
  /** Small uppercase line above the title. */
  eyebrow: string;
  title: ReactNode;
  /** The card's content; fills the space between the header and the actions. */
  children: ReactNode;
  /** Exactly one primary (GlassCta*) and one secondary (OutlineCta*) Landing CTA, each `w-full`. */
  actions: ReactNode;
  className?: string;
}

/**
 * The single shell for every Today Holo Card.
 *
 * Passport, the next move and the activity summary used to each lay out their
 * own header, spacing and action row, so the three cards drifted apart (a
 * different eyebrow tracking, a decorative icon on one, an action row that
 * wrapped on another). They now share the same anatomy by construction:
 *
 *   eyebrow + title            <- always the same type scale
 *   content (fills the card)
 *   ── hairline ──
 *   primary + secondary CTA    <- always the Landing pair, stacked, full width
 *
 * Equal height comes from the grid's `auto-rows-fr` plus the shared min height.
 */
export function TodayCard({ label, eyebrow, title, children, actions, className }: TodayCardProps) {
  return (
    <HoloCard maxTilt={3} className="h-full min-w-0">
      <section
        aria-label={label}
        className={cn(
          "relative flex h-full min-h-[460px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-7",
          className,
        )}
      >
        <header className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-2 break-words text-xl font-bold leading-tight text-foreground">{title}</h2>
        </header>
        <div className="mt-5 flex min-w-0 flex-1 flex-col">{children}</div>
        <div className="mt-6 grid gap-3 border-t border-border pt-5">{actions}</div>
      </section>
    </HoloCard>
  );
}

export default TodayCard;
