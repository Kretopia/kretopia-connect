import { useMemo } from "react";

/**
 * Project Flow stages — the lifecycle of a creative project in ThriveDesk.
 * Order matters: completion % is derived from index of current stage.
 */
export const PROJECT_FLOW_STAGES = [
  { id: "discussion", label: "Discussion", tab: "messages", short: "Talk" },
  { id: "brief", label: "Scope & Brief", tab: "notes", short: "Brief" },
  { id: "tasks", label: "Tasks", tab: "tasks", short: "Tasks" },
  { id: "work", label: "Work Upload", tab: "files", short: "Work" },
  { id: "review", label: "Review & Approval", tab: "approvals", short: "Review" },
  { id: "agreement", label: "Agreement", tab: "contracts", short: "Agreement" },
  { id: "payment", label: "Payment", tab: "finance", short: "Pay" },
  { id: "complete", label: "Complete", tab: "today", short: "Done" },
] as const;

export type ProjectFlowStageId = (typeof PROJECT_FLOW_STAGES)[number]["id"];

/**
 * Four-phase user-facing model (Studio overhaul v3, consolidated from an
 * earlier six-phase version — Discuss+Define merged into Kickoff, and
 * Review+Commit merged into Wrap, since each pair was really one decision
 * split across two markers). Purely a display grouping over the existing
 * 8 stages above — the stages themselves, their tab ids, and
 * deriveStage()'s activity-based logic are untouched, since every stage id
 * is load-bearing elsewhere (StudioToolBar, DeskTabContent, the CTA "tab"
 * targets below). No DB column stores a phase; it's derived the same way
 * currentStageId already is.
 */
export const STUDIO_PHASES = [
  { id: "kickoff", label: "Kickoff" },
  { id: "build", label: "Build" },
  { id: "wrap", label: "Wrap" },
  { id: "complete", label: "Complete" },
] as const;

export type StudioPhaseId = (typeof STUDIO_PHASES)[number]["id"];

const STAGE_TO_PHASE: Record<ProjectFlowStageId, StudioPhaseId> = {
  discussion: "kickoff",
  brief: "kickoff",
  tasks: "build",
  work: "build",
  review: "wrap",
  agreement: "wrap",
  payment: "wrap",
  complete: "complete",
};

export function stageToPhase(stageId: ProjectFlowStageId): StudioPhaseId {
  return STAGE_TO_PHASE[stageId];
}

export interface ProjectFlowSignals {
  messageCount: number;
  noteCount: number;
  taskCount: number;
  taskDoneCount: number;
  fileCount: number;
  approvalApprovedCount: number;
  approvalPendingCount: number;
  contractCount: number;
  contractSignedCount: number;
  invoiceCount: number;
  invoicePaidCount: number;
  milestoneCount: number;
  projectStatus?: string | null;
  pinnedStage?: string | null;
}

export interface NextStep {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTab: string; // which tab to navigate to
  ctaIntent?: string; // optional hint, dispatched as event for prefill
  secondary?: { label: string; tab: string; intent?: string };
}

export interface ProjectFlow {
  currentStageId: ProjectFlowStageId;
  currentStageIndex: number;
  completionPct: number;
  isPinned: boolean;
  derivedStageId: ProjectFlowStageId;
  stageStatus: Record<ProjectFlowStageId, "complete" | "current" | "todo">;
  nextStep: NextStep;
  currentPhaseId: StudioPhaseId;
  phaseStatus: Record<StudioPhaseId, "complete" | "current" | "todo">;
  /** Whether the current stage's own requirement is actually met yet — gates
   * the phase rail's "Validate & continue" button so it can't be used to
   * skip ahead of real progress. Same rules deriveStage() walks below,
   * exposed per-stage instead of only as a full-signal derivation. */
  canAdvance: boolean;
}

/**
 * Stage satisfaction rules — intentionally loose so users feel progress
 * fast. Exported (not just used internally by deriveStage) so the phase
 * rail's validate button can check "is *this* stage's requirement met"
 * without re-deriving the whole flow.
 */
export function isStageSatisfied(stageId: ProjectFlowStageId, s: ProjectFlowSignals): boolean {
  switch (stageId) {
    case "discussion": return s.messageCount >= 1;
    case "brief": return s.noteCount >= 1;
    case "tasks": return s.taskCount >= 1;
    case "work": return s.fileCount >= 1;
    case "review": return s.approvalApprovedCount >= 1 || (s.approvalPendingCount === 0 && s.fileCount >= 1 && s.taskDoneCount >= 1 && s.taskCount > 0);
    case "agreement": return s.contractCount >= 1;
    case "payment": return s.invoicePaidCount >= 1 || (s.milestoneCount > 0 && s.invoiceCount >= 1);
    case "complete": return s.projectStatus === "completed";
  }
}

/**
 * Derive the project's current lifecycle stage from activity signals.
 * Walks stages in order; the first stage that's NOT yet "satisfied"
 * becomes the current stage. Earlier stages = complete.
 */
function deriveStage(s: ProjectFlowSignals): ProjectFlowStageId {
  if (s.projectStatus === "completed") return "complete";
  for (const stage of PROJECT_FLOW_STAGES) {
    if (!isStageSatisfied(stage.id, s)) return stage.id;
  }
  return "complete";
}

/**
 * Pick the most useful "Next Step" for the current stage.
 * Each step has a CTA that navigates to a tab — and optionally dispatches
 * a window event that the target tab/component can listen for to prefill.
 */
function buildNextStep(stageId: ProjectFlowStageId, s: ProjectFlowSignals): NextStep {
  switch (stageId) {
    case "discussion":
      return {
        id: "start-chat",
        title: "Kick off the conversation",
        description: "Send the first message to align on the project before diving in.",
        ctaLabel: "Open Chat",
        ctaTab: "messages",
        secondary: { label: "Write a brief instead", tab: "notes" },
      };
    case "brief":
      return {
        id: "write-brief",
        title: "Define the project scope",
        description: "Capture goals, deliverables, and creative direction in a brief.",
        ctaLabel: "Write Brief",
        ctaTab: "notes",
        ctaIntent: "create-brief",
        secondary: { label: "Use AI to draft it", tab: "ai", intent: "ai-brief" },
      };
    case "tasks":
      return {
        id: "spark-or-tasks",
        title: "Spark ideas, then break it down",
        description: "Pin concepts to your cork board, or jump straight to tasks.",
        ctaLabel: "Spark Ideas",
        ctaTab: "notes",
        ctaIntent: "spark-ideas",
        secondary: { label: "Create first task", tab: "tasks", intent: "create-task" },
      };
    case "work":
      return {
        id: "upload-work",
        title: "Upload your first draft",
        description: "Share work-in-progress files so collaborators can review.",
        ctaLabel: "Upload Files",
        ctaTab: "files",
        ctaIntent: "upload-file",
        secondary: { label: "Mark a task done", tab: "tasks" },
      };
    case "review":
      return {
        id: "request-approval",
        title: "Request approval on deliverables",
        description: "Send work for sign-off so you can move toward payment.",
        ctaLabel: "Request Approval",
        ctaTab: "approvals",
        ctaIntent: "create-approval",
        secondary: { label: "Add another draft", tab: "files" },
      };
    case "agreement":
      return {
        id: "create-contract",
        title: "Lock in the agreement",
        description: "Generate a contract to protect scope, timeline, and payment.",
        ctaLabel: "Create Agreement",
        ctaTab: "contracts",
        ctaIntent: "create-contract",
        secondary: { label: "Use a template", tab: "contracts", intent: "contract-template" },
      };
    case "payment":
      if (s.milestoneCount === 0) {
        return {
          id: "create-milestone",
          title: "Set up your first milestone",
          description: "Break payment into stages so you get paid as you deliver.",
          ctaLabel: "Add Milestone",
          ctaTab: "finance",
          ctaIntent: "create-milestone",
          secondary: { label: "Send a deposit invoice", tab: "finance", intent: "create-invoice" },
        };
      }
      return {
        id: "send-invoice",
        title: "Send your invoice",
        description: "Bill for completed milestones to get paid.",
        ctaLabel: "Send Invoice",
        ctaTab: "finance",
        ctaIntent: "create-invoice",
        secondary: { label: "Add a milestone", tab: "finance", intent: "create-milestone" },
      };
    case "complete":
      return {
        id: "wrap-up",
        title: "Project complete 🎉",
        description: "Wrap up by collecting a testimonial or starting your next project.",
        ctaLabel: "View Summary",
        ctaTab: "today",
      };
  }
}

export function useProjectFlow(signals: ProjectFlowSignals): ProjectFlow {
  return useMemo(() => {
    const derivedStageId = deriveStage(signals);
    const pinnedValid = signals.pinnedStage && PROJECT_FLOW_STAGES.some((s) => s.id === signals.pinnedStage);
    const isPinned = !!pinnedValid;
    const currentStageId = (isPinned ? signals.pinnedStage : derivedStageId) as ProjectFlowStageId;
    const currentStageIndex = PROJECT_FLOW_STAGES.findIndex((s) => s.id === currentStageId);
    const completionPct = Math.round(((currentStageIndex) / (PROJECT_FLOW_STAGES.length - 1)) * 100);

    const stageStatus = {} as Record<ProjectFlowStageId, "complete" | "current" | "todo">;
    PROJECT_FLOW_STAGES.forEach((stage, idx) => {
      if (idx < currentStageIndex) stageStatus[stage.id] = "complete";
      else if (idx === currentStageIndex) stageStatus[stage.id] = "current";
      else stageStatus[stage.id] = "todo";
    });

    const phaseStatus = {} as Record<StudioPhaseId, "complete" | "current" | "todo">;
    for (const phase of STUDIO_PHASES) {
      const statuses = PROJECT_FLOW_STAGES
        .filter((s) => STAGE_TO_PHASE[s.id] === phase.id)
        .map((s) => stageStatus[s.id]);
      phaseStatus[phase.id] = statuses.includes("current")
        ? "current"
        : statuses.every((st) => st === "complete")
        ? "complete"
        : "todo";
    }

    return {
      currentStageId,
      currentStageIndex,
      completionPct,
      isPinned,
      derivedStageId,
      stageStatus,
      nextStep: buildNextStep(currentStageId, signals),
      currentPhaseId: stageToPhase(currentStageId),
      phaseStatus,
      canAdvance: isStageSatisfied(currentStageId, signals),
    };
  }, [signals]);
}
