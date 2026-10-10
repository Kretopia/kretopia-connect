import type { ReactNode } from "react";

import { SceneBanner } from "@/components/brand/SceneBanner";
import type { KretoSceneId } from "@/components/brand/kretoScenes";
import { cn } from "@/lib/utils";

interface TodayCardProps {
  /** Accessible name of the card's region. */
  label: string;
  /** Small uppercase line above the title. */
  eyebrow: string;
  title: ReactNode;
  /** Which Kreto scene runs across the top of this card. Every card on Today has a different one. */
  scene: KretoSceneId;
  /** Words after the K in the banner's chip ("Passport" gives "Kretopia · Passport"). */
  sceneLabel?: string;
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
 *   Kreto scene banner       (a different scene per card, signed Kretopia)
 *   eyebrow + title
 *   content (fills the card)
 *   ── hairline ──
 *   primary + secondary CTA  <- always the Landing pair, stacked, full width
 *
 * Plain surface: no tilt, no sheen, no glow. The card does not react to the
 * pointer; the content and the actions do. Equal height comes from the grid's
 * `auto-rows-fr` (or the deck) plus the shared min height.
 */
export function TodayCard({ label, eyebrow, title, scene, sceneLabel, children, actions, className }: TodayCardProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "relative flex h-full min-h-[460px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <SceneBanner scene={scene} label={sceneLabel} fade className="h-36 w-full shrink-0 sm:h-44" />
      <div className="flex min-w-0 flex-1 flex-col p-6 pt-4 sm:p-7 sm:pt-5">
        <header className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-2 break-words text-xl font-bold leading-tight text-foreground">{title}</h2>
        </header>
        <div className="mt-5 flex min-w-0 flex-1 flex-col">{children}</div>
        <div className="mt-6 grid gap-3 border-t border-border pt-5">{actions}</div>
      </div>
    </section>
  );
}

export default TodayCard;
