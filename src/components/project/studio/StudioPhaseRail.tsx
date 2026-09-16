import { memo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  PROJECT_FLOW_STAGES,
  STUDIO_PHASES,
  type ProjectFlow,
  type ProjectFlowStageId,
  type StudioPhaseId,
} from "@/hooks/useProjectFlow";

interface StudioPhaseRailProps {
  flow: ProjectFlow;
  /** Jumps to the tab of the first stage inside the clicked phase. */
  onPhaseClick: (tab: string) => void;
  onPinStage?: (stageId: ProjectFlowStageId | null) => void;
  /** Explicit "I'm done with this phase" CTA — advances to the next
   * phase, notifies collaborators, and (on reaching Complete) opens the
   * informative dialog. Omit to hide the button entirely. */
  onValidateStep?: () => void;
  className?: string;
}

/**
 * Studio Room's one-page "where am I" indicator — a single animated
 * progress bar (not a row of pills) with a labeled marker per phase
 * underneath. Purely a grouped view over the existing 8-stage
 * useProjectFlow() data (see stageToPhase in that hook); introduces no
 * new progression system and no new stored state.
 *
 * Sequential gating, by design: a phase whose status is "todo" (not yet
 * reached) is not clickable — you can always step back into a completed
 * phase or work the current one, but you can't jump ahead to preview a
 * phase before its predecessor is actually satisfied. Locked markers
 * show a small lock glyph instead of a step number so the restriction
 * reads as intentional, not broken.
 */
export const StudioPhaseRail = memo(({ flow, onPhaseClick, onPinStage, onValidateStep, className }: StudioPhaseRailProps) => {
  const reducedMotion = useReducedMotion();
  const currentPhaseLabel = STUDIO_PHASES.find((p) => p.id === flow.currentPhaseId)?.label ?? "";

  const phaseTab = (phaseId: StudioPhaseId) => {
    const stageIds = phaseTabStages(phaseId);
    return PROJECT_FLOW_STAGES.find((s) => stageIds.includes(s.id))?.tab ?? "today";
  };

  return (
    <div className={cn("px-4 pt-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {flow.completionPct}% through Studio
        </span>
        {onPinStage && (
          <button
            type="button"
            onClick={() => onPinStage(flow.isPinned ? null : flow.currentStageId)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            title={flow.isPinned ? "Let Studio auto-detect the phase" : "Pin this phase so it doesn't auto-advance"}
          >
            {flow.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            {flow.isPinned ? "Pinned" : "Pin"}
          </button>
        )}
      </div>

      {/* Track — single gray-to-pink gradient fill, animated to the real
          completion percentage. No step pills, no per-segment coloring. */}
      <div className="relative h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: "linear-gradient(90deg, hsl(var(--muted-foreground) / 0.5), hsl(var(--energy)))",
            boxShadow: "0 0 12px hsl(var(--energy) / 0.5)",
          }}
          initial={false}
          animate={{ width: `${Math.max(flow.completionPct, 3)}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.6, ease: [0.2, 0.65, 0.3, 0.95] }}
        />
      </div>

      {/* Markers — labeled, but only complete/current phases are
          interactive. A "todo" phase is locked: no onClick, dimmed, a
          lock glyph instead of relying on color alone to say "not yet." */}
      <div className="mt-2 flex items-start justify-between gap-0.5">
        {STUDIO_PHASES.map((phase) => {
          const status = flow.phaseStatus[phase.id];
          const locked = status === "todo";
          return (
            <button
              key={phase.id}
              type="button"
              disabled={locked}
              aria-current={status === "current" ? "step" : undefined}
              aria-disabled={locked}
              onClick={() => !locked && onPhaseClick(phaseTab(phase.id))}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-0.5 rounded-md transition-colors",
                locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.04]"
              )}
              title={locked ? `${phase.label} — complete the earlier steps first` : phase.label}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  status === "current" && "ring-2 ring-[hsl(var(--energy)/0.25)]"
                )}
                style={{
                  backgroundColor:
                    status === "todo" ? "hsl(0 0% 100% / 0.15)" : "hsl(var(--energy))",
                }}
              />
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wide leading-tight text-center flex items-center gap-0.5",
                  status === "current" && "text-foreground",
                  status === "complete" && "text-muted-foreground",
                  status === "todo" && "text-muted-foreground/35"
                )}
              >
                {locked && <Lock className="h-2 w-2 shrink-0" aria-hidden />}
                {phase.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explicit validation — the phase only ever advances on this
          click, never silently. Compact and right-aligned rather than
          spanning the full width, since it's one action among several in
          this header, not the page's primary CTA. Disabled (with a
          one-line reason) until the current stage's own requirement is
          actually met, so it can't be used to skip ahead of real
          progress — reuses the exact rule deriveStage() itself walks. */}
      {onValidateStep && flow.currentPhaseId !== "complete" && (
        <div className="mt-2.5 flex items-center justify-end gap-2">
          {!flow.canAdvance && (
            <span className="text-[10px] text-muted-foreground truncate">{flow.nextStep.title}</span>
          )}
          <Button
            type="button"
            size="sm"
            onClick={onValidateStep}
            disabled={!flow.canAdvance}
            title={flow.canAdvance ? undefined : flow.nextStep.description}
            className="gap-1.5 shrink-0"
          >
            Validate "{currentPhaseLabel}"
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
});

StudioPhaseRail.displayName = "StudioPhaseRail";

function phaseTabStages(phaseId: StudioPhaseId): ProjectFlowStageId[] {
  const map: Record<StudioPhaseId, ProjectFlowStageId[]> = {
    kickoff: ["discussion", "brief"],
    build: ["tasks", "work"],
    wrap: ["review", "agreement", "payment"],
    complete: ["complete"],
  };
  return map[phaseId];
}
