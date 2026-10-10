import type { ReactNode } from "react";

import { KretoCharacter, type KretoCharacterVariant } from "@/components/brand/KretoCharacter";
import { cn } from "@/lib/utils";

interface TodayCardProps {
  /** Accessible name of the card's region. */
  label: string;
  /** Small uppercase line above the title. */
  eyebrow: string;
  title: ReactNode;
  /** Which of Kreto's robots stands in this card's corner. Every card on Today has a different one. */
  robot: KretoCharacterVariant;
  /** The card's content; fills the space between the header and the actions. */
  children: ReactNode;
  /** Exactly one primary (GlassCta*) and one secondary (OutlineCta*) Landing CTA, each `w-full`. */
  actions: ReactNode;
  className?: string;
}

/**
 * The single shell for every Today card.
 *
 * Passport, the next move and the activity summary share one anatomy by
 * construction:
 *
 *   eyebrow + title          (and one Kreto robot in the corner, a different one per card)
 *   content (fills the card)
 *   ── hairline ──
 *   primary + secondary CTA  <- always the Landing pair, stacked, full width
 *
 * Plain surface: no tilt, no sheen, no glow. The card does not react to the
 * pointer; the content and the actions do. Equal height comes from the grid's
 * `auto-rows-fr` (or the deck) plus the shared min height.
 */
export function TodayCard({ label, eyebrow, title, robot, children, actions, className }: TodayCardProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "relative flex h-full min-h-[460px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-7",
        className,
      )}
    >
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-2 break-words text-xl font-bold leading-tight text-foreground">{title}</h2>
        </div>
        <KretoCharacter variant={robot} size={64} floatAmplitude={1} floatDuration={8} className="pointer-events-none -mr-1 -mt-1 shrink-0" />
      </header>
      <div className="mt-5 flex min-w-0 flex-1 flex-col">{children}</div>
      <div className="mt-6 grid gap-3 border-t border-border pt-5">{actions}</div>
    </section>
  );
}

export default TodayCard;
