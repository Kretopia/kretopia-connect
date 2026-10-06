import { memo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Lock, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { KretoMark } from "@/components/brand/KretoMark";
import { KretoTyping } from "@/components/brand/KretoTyping";
import {
  PROJECT_FLOW_STAGES,
  STUDIO_PHASES,
  type ProjectFlow,
  type ProjectFlowStageId,
  type StudioPhaseId,
} from "@/hooks/useProjectFlow";

/**
 * The Studio Room's "where am I" view, folded into two main components instead
 * of one rail of four markers:
 *
 *   Make     = Kickoff + Build       (set it up, then do the work)
 *   Deliver  = Wrap + Complete       (review, agree, get paid, close)
 *
 * Still a purely grouped view over useProjectFlow(): no new progression system
 * and no new stored state. Sequential gating is unchanged: a phase that is not
 * reached yet ("todo") is locked and not clickable, so you can step back into a
 * finished phase or work the current one but never preview ahead of real
 * progress. The "Move to…" action lives in <StudioMoveDock />.
 */

interface StageDef {
  id: "make" | "deliver";
  label: string;
  tagline: string;
  phases: readonly [StudioPhaseId, StudioPhaseId];
}

const MAKE: StageDef = { id: "make", label: "Make", tagline: "Set it up, then build it", phases: ["kickoff", "build"] };
const DELIVER: StageDef = { id: "deliver", label: "Deliver", tagline: "Review, wrap and get paid", phases: ["wrap", "complete"] };

const phaseLabel = (id: StudioPhaseId) => STUDIO_PHASES.find((p) => p.id === id)?.label ?? id;

const PHASE_STAGES: Record<StudioPhaseId, ProjectFlowStageId[]> = {
  kickoff: ["discussion", "brief"],
  build: ["tasks", "work"],
  wrap: ["review", "agreement", "payment"],
  complete: ["complete"],
};

/** The tab a phase opens: the tab of its first stage. */
const phaseTab = (phaseId: StudioPhaseId): string =>
  PROJECT_FLOW_STAGES.find((s) => PHASE_STAGES[phaseId].includes(s.id))?.tab ?? "today";

type StageState = "done" | "current" | "upcoming";

const stageState = (def: StageDef, flow: ProjectFlow): StageState => {
  const statuses = def.phases.map((p) => flow.phaseStatus[p]);
  if (statuses.every((s) => s === "complete")) return "done";
  if (statuses.some((s) => s === "current" || s === "complete")) return "current";
  return "upcoming";
};

const stageProgress = (def: StageDef, flow: ProjectFlow): number => {
  const done = def.phases.filter((p) => flow.phaseStatus[p] === "complete").length;
  const current = def.phases.some((p) => flow.phaseStatus[p] === "current") ? 0.5 : 0;
  return Math.min(1, (done + current) / def.phases.length);
};

interface StageCardProps {
  def: StageDef;
  flow: ProjectFlow;
  onPhaseClick: (tab: string) => void;
  mascot: ReactNode;
}

const StageCard = memo(({ def, flow, onPhaseClick, mascot }: StageCardProps) => {
  const reducedMotion = useReducedMotion();
  const state = stageState(def, flow);
  const progress = stageProgress(def, flow);

  return (
    <section
      aria-label={`${def.label} stage`}
      data-state={state}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl border p-3 transition-colors",
        state === "current" && "border-[hsl(var(--energy)/0.45)] bg-[hsl(var(--energy)/0.06)]",
        state === "done" && "border-border bg-card/60",
        state === "upcoming" && "border-border/60 bg-card/30",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--energy))]">
            {state === "done" ? "Done" : state === "current" ? "You are here" : "Next"}
          </p>
          <h3 className="text-base font-black leading-tight tracking-tight">{def.label}</h3>
          <p className="truncate text-[10px] text-muted-foreground">{def.tagline}</p>
        </div>
        <div className="-mt-1 -mr-1 shrink-0">{mascot}</div>
      </header>

      <ol className="mt-2 grid grid-cols-2 gap-1.5">
        {def.phases.map((phaseId) => {
          const status = flow.phaseStatus[phaseId];
          const locked = status === "todo";
          return (
            <li key={phaseId} className="min-w-0">
              <button
                type="button"
                disabled={locked}
                aria-current={status === "current" ? "step" : undefined}
                onClick={() => onPhaseClick(phaseTab(phaseId))}
                title={locked ? `${phaseLabel(phaseId)} — complete the earlier steps first` : phaseLabel(phaseId)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[11px] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  status === "current" &&
                    "border-[hsl(var(--energy)/0.5)] bg-[hsl(var(--energy)/0.14)] text-foreground",
                  status === "complete" && "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                  locked && "cursor-not-allowed border-transparent text-muted-foreground/45",
                )}
              >
                {status === "complete" && <Check className="h-3 w-3 shrink-0 text-[hsl(var(--energy))]" aria-hidden />}
                {locked && <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden />}
                {status === "current" && (
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--energy))] ring-2 ring-[hsl(var(--energy)/0.25)]" />
                )}
                <span className="truncate">{phaseLabel(phaseId)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]" role="presentation">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, hsl(var(--muted-foreground) / 0.5), hsl(var(--energy)))",
            boxShadow: "0 0 10px hsl(var(--energy) / 0.45)",
          }}
          initial={false}
          animate={{ width: `${Math.max(progress * 100, 4)}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.6, ease: [0.2, 0.65, 0.3, 0.95] }}
        />
      </div>
    </section>
  );
});
StageCard.displayName = "StageCard";

type StageProps = Pick<StageCardProps, "flow" | "onPhaseClick">;

/** Component 1 of 2: Kickoff + Build. Kreto types away at his laptop (hover or tap). */
export const StudioMakeStage = ({ flow, onPhaseClick }: StageProps) => (
  <StageCard
    def={MAKE}
    flow={flow}
    onPhaseClick={onPhaseClick}
    mascot={<KretoTyping className="h-[3.75rem] sm:h-[4.5rem]" />}
  />
);

/** Component 2 of 2: Wrap + Complete. */
export const StudioDeliverStage = ({ flow, onPhaseClick }: StageProps) => (
  <StageCard
    def={DELIVER}
    flow={flow}
    onPhaseClick={onPhaseClick}
    mascot={<KretoMark variant="compact" size="md" />}
  />
);

interface StudioStagesProps extends StageProps {
  onPinStage?: (stageId: ProjectFlowStageId | null) => void;
  className?: string;
}

export const StudioStages = memo(({ flow, onPhaseClick, onPinStage, className }: StudioStagesProps) => (
  <div className={cn("px-4 pt-3 pb-3", className)}>
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {flow.completionPct}% through Studio
      </span>
      {onPinStage && (
        <button
          type="button"
          onClick={() => onPinStage(flow.isPinned ? null : flow.currentStageId)}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          title={flow.isPinned ? "Let Studio auto-detect the phase" : "Pin this phase so it doesn't auto-advance"}
        >
          {flow.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          {flow.isPinned ? "Pinned" : "Pin"}
        </button>
      )}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <StudioMakeStage flow={flow} onPhaseClick={onPhaseClick} />
      <StudioDeliverStage flow={flow} onPhaseClick={onPhaseClick} />
    </div>
  </div>
));
StudioStages.displayName = "StudioStages";
