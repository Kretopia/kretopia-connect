import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProjectFlow, stageToPhase, isStageSatisfied, STUDIO_PHASES, type ProjectFlowSignals } from "../useProjectFlow";

const baseSignals: ProjectFlowSignals = {
  messageCount: 0,
  noteCount: 0,
  taskCount: 0,
  taskDoneCount: 0,
  fileCount: 0,
  approvalApprovedCount: 0,
  approvalPendingCount: 0,
  contractCount: 0,
  contractSignedCount: 0,
  invoiceCount: 0,
  invoicePaidCount: 0,
  milestoneCount: 0,
};

describe("stageToPhase", () => {
  it("maps every one of the 8 stages onto one of the 4 phases, in order", () => {
    expect(stageToPhase("discussion")).toBe("kickoff");
    expect(stageToPhase("brief")).toBe("kickoff");
    expect(stageToPhase("tasks")).toBe("build");
    expect(stageToPhase("work")).toBe("build");
    expect(stageToPhase("review")).toBe("wrap");
    expect(stageToPhase("agreement")).toBe("wrap");
    expect(stageToPhase("payment")).toBe("wrap");
    expect(stageToPhase("complete")).toBe("complete");
  });

  it("never maps a stage outside the 4 known phase ids", () => {
    const knownPhaseIds = new Set(STUDIO_PHASES.map((p) => p.id));
    const stages = ["discussion", "brief", "tasks", "work", "review", "agreement", "payment", "complete"] as const;
    for (const s of stages) {
      expect(knownPhaseIds.has(stageToPhase(s))).toBe(true);
    }
  });
});

describe("useProjectFlow — four-phase display model", () => {
  it("starts at phase 'kickoff' with nothing else complete", () => {
    const { result } = renderHook(() => useProjectFlow(baseSignals));
    expect(result.current.currentStageId).toBe("discussion");
    expect(result.current.currentPhaseId).toBe("kickoff");
    expect(result.current.phaseStatus.kickoff).toBe("current");
    expect(result.current.phaseStatus.build).toBe("todo");
    expect(result.current.phaseStatus.complete).toBe("todo");
  });

  it("marks 'kickoff' current (not complete) while only one of its two stages is satisfied", () => {
    // discussion satisfied (messageCount >= 1) but brief isn't (noteCount === 0) --
    // kickoff spans both the "discussion" and "brief" stages, so the phase
    // should read as in-progress, not complete, until both are done.
    const { result } = renderHook(() =>
      useProjectFlow({ ...baseSignals, messageCount: 1 })
    );
    expect(result.current.currentStageId).toBe("brief");
    expect(result.current.currentPhaseId).toBe("kickoff");
    expect(result.current.phaseStatus.kickoff).toBe("current");
  });

  it("marks 'build' current (not complete) while only one of its two stages is satisfied", () => {
    // tasks satisfied (taskCount >= 1) but work isn't (fileCount === 0) --
    // build spans both the "tasks" and "work" stages, so the phase should
    // read as in-progress, not complete, until both are done.
    const { result } = renderHook(() =>
      useProjectFlow({ ...baseSignals, messageCount: 1, noteCount: 1, taskCount: 1 })
    );
    expect(result.current.currentStageId).toBe("work");
    expect(result.current.currentPhaseId).toBe("build");
    expect(result.current.phaseStatus.kickoff).toBe("complete");
    expect(result.current.phaseStatus.build).toBe("current");
    expect(result.current.phaseStatus.wrap).toBe("todo");
  });

  it("marks 'wrap' complete only once review, agreement and payment all clear", () => {
    const { result } = renderHook(() =>
      useProjectFlow({
        ...baseSignals,
        messageCount: 1, noteCount: 1, taskCount: 1, fileCount: 1,
        approvalApprovedCount: 1, contractCount: 1,
        // payment stage NOT yet satisfied
      })
    );
    expect(result.current.currentStageId).toBe("payment");
    expect(result.current.currentPhaseId).toBe("wrap");
    expect(result.current.phaseStatus.wrap).toBe("current");
  });

  it("reaches 'complete' when projectStatus is completed, regardless of other signals", () => {
    const { result } = renderHook(() =>
      useProjectFlow({ ...baseSignals, projectStatus: "completed" })
    );
    expect(result.current.currentStageId).toBe("complete");
    expect(result.current.currentPhaseId).toBe("complete");
    expect(result.current.phaseStatus.complete).toBe("current");
    for (const phase of STUDIO_PHASES) {
      if (phase.id !== "complete") expect(result.current.phaseStatus[phase.id]).toBe("complete");
    }
  });

  it("a pinned stage overrides the derived stage but still maps to a valid phase", () => {
    const { result } = renderHook(() =>
      useProjectFlow({ ...baseSignals, pinnedStage: "agreement" })
    );
    expect(result.current.isPinned).toBe(true);
    expect(result.current.currentStageId).toBe("agreement");
    expect(result.current.currentPhaseId).toBe("wrap");
  });
});

describe("canAdvance / isStageSatisfied — gates the phase rail's Validate button", () => {
  it("cannot advance out of the current stage until its own requirement is met", () => {
    const { result } = renderHook(() => useProjectFlow(baseSignals));
    expect(result.current.currentStageId).toBe("discussion");
    expect(result.current.canAdvance).toBe(false);
  });

  it("can advance once the current stage's requirement is satisfied", () => {
    const { result } = renderHook(() => useProjectFlow({ ...baseSignals, messageCount: 1 }));
    expect(result.current.currentStageId).toBe("brief");
    expect(result.current.canAdvance).toBe(false); // brief's own requirement (noteCount) still unmet

    const { result: result2 } = renderHook(() =>
      useProjectFlow({ ...baseSignals, messageCount: 1, noteCount: 1 })
    );
    expect(result2.current.currentStageId).toBe("tasks");
    expect(result2.current.canAdvance).toBe(false); // tasks' own requirement still unmet
  });

  it("isStageSatisfied reflects the same rule deriveStage uses internally, per stage", () => {
    expect(isStageSatisfied("discussion", baseSignals)).toBe(false);
    expect(isStageSatisfied("discussion", { ...baseSignals, messageCount: 1 })).toBe(true);
    expect(isStageSatisfied("payment", { ...baseSignals, invoicePaidCount: 1 })).toBe(true);
    expect(isStageSatisfied("payment", { ...baseSignals, milestoneCount: 1, invoiceCount: 1 })).toBe(true);
    expect(isStageSatisfied("payment", baseSignals)).toBe(false);
  });
});
