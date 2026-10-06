import { memo } from "react";
import { ArrowRight } from "lucide-react";
import { CtaButton } from "@/components/ui/cta-button";
import { KretoMark } from "@/components/brand/KretoMark";
import { cn } from "@/lib/utils";
import { STUDIO_PHASES, type ProjectFlow } from "@/hooks/useProjectFlow";

interface StudioMoveDockProps {
  flow: ProjectFlow;
  /** Explicit "I'm done with this phase": advances, notifies collaborators, and on
   * reaching Complete opens the informative dialog. Phases never advance silently. */
  onValidateStep: () => void;
  className?: string;
}

/**
 * The one "Move to…" action of a Studio Room, docked bottom-right.
 *
 * Why here and not in the stage cards: the cards say *where you are*; this says
 * *what one click does*, so it belongs where a thumb or cursor already rests,
 * not in the middle of a row of status markers. The label names the destination
 * ("Move to Build"), and the button stays disabled, with the reason beside it,
 * until the current stage's own requirement is actually met (the exact rule
 * deriveStage() walks), so it can't be used to skip ahead of real progress.
 *
 * Placement: on desktop it sits left of the Kreto launcher (which owns the
 * bottom-right corner), on mobile above the bottom nav. No backdrop blur on a
 * fixed surface.
 */
export const StudioMoveDock = memo(({ flow, onValidateStep, className }: StudioMoveDockProps) => {
  if (flow.currentPhaseId === "complete") return null;

  const currentIdx = STUDIO_PHASES.findIndex((p) => p.id === flow.currentPhaseId);
  const currentLabel = STUDIO_PHASES[currentIdx]?.label ?? "";
  const nextLabel = STUDIO_PHASES[currentIdx + 1]?.label ?? "Complete";

  return (
    <div
      role="region"
      aria-label="Next phase"
      className={cn(
        "fixed z-30 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border bg-card p-1.5 pl-2 shadow-xl",
        "right-3 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] lg:right-[8.25rem] lg:bottom-5",
        flow.canAdvance ? "border-[hsl(var(--energy)/0.55)]" : "border-border",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
        className,
      )}
    >
      <KretoMark variant="compact" size="sm" />
      <p className="hidden min-w-0 max-w-[14rem] text-[11px] leading-tight text-muted-foreground sm:block">
        {flow.canAdvance ? (
          <>
            <span className="font-semibold text-foreground">{currentLabel} is ready.</span> One click moves this Project into {nextLabel}.
          </>
        ) : (
          flow.nextStep.title
        )}
      </p>
      <CtaButton
        type="button"
        size="sm"
        onClick={onValidateStep}
        disabled={!flow.canAdvance}
        title={flow.canAdvance ? `Finish ${currentLabel} and move into ${nextLabel}` : flow.nextStep.description}
        className="w-auto shrink-0 gap-1.5 rounded-xl"
      >
        Move to {nextLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </CtaButton>
      {!flow.canAdvance && <span className="sr-only sm:hidden">{flow.nextStep.title}</span>}
    </div>
  );
});
StudioMoveDock.displayName = "StudioMoveDock";
