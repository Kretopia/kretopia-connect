import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StudioStages } from "../StudioStages";
import { StudioMoveDock } from "../StudioMoveDock";
import type { ProjectFlow } from "@/hooks/useProjectFlow";

/**
 * The four phases are folded into two main components:
 *   Make = Kickoff + Build, Deliver = Wrap + Complete.
 * Same sequential gating as before, and the "Move to…" action now lives in a
 * separate dock (bottom-right) instead of inside the stage row.
 */

const baseFlow: ProjectFlow = {
  currentStageId: "discussion",
  currentStageIndex: 0,
  completionPct: 10,
  isPinned: false,
  derivedStageId: "discussion",
  stageStatus: {
    discussion: "current", brief: "todo", tasks: "todo", work: "todo",
    review: "todo", agreement: "todo", payment: "todo", complete: "todo",
  },
  nextStep: { id: "brief", title: "Add a brief to move on", description: "Write or generate a brief first.", ctaLabel: "Add brief", ctaTab: "notes" },
  currentPhaseId: "kickoff",
  phaseStatus: { kickoff: "current", build: "todo", wrap: "todo", complete: "todo" },
  canAdvance: false,
};

const inBuild: ProjectFlow = {
  ...baseFlow,
  currentPhaseId: "build",
  completionPct: 45,
  phaseStatus: { kickoff: "complete", build: "current", wrap: "todo", complete: "todo" },
};

describe("StudioStages — two main components", () => {
  it("shows exactly two stages, Make and Deliver, each holding two phases", () => {
    render(<StudioStages flow={baseFlow} onPhaseClick={vi.fn()} />);
    const make = screen.getByRole("region", { name: "Make stage" });
    const deliver = screen.getByRole("region", { name: "Deliver stage" });
    expect(within(make).getByRole("button", { name: /Kickoff/ })).toBeInTheDocument();
    expect(within(make).getByRole("button", { name: /Build/ })).toBeInTheDocument();
    expect(within(deliver).getByRole("button", { name: /Wrap/ })).toBeInTheDocument();
    expect(within(deliver).getByRole("button", { name: /Complete/ })).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(2);
  });

  it("marks where you are and keeps later phases locked", () => {
    render(<StudioStages flow={baseFlow} onPhaseClick={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Make stage" })).toHaveAttribute("data-state", "current");
    expect(screen.getByRole("region", { name: "Deliver stage" })).toHaveAttribute("data-state", "upcoming");
    expect(screen.getByRole("button", { name: /Kickoff/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /Build/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Wrap/ })).toBeDisabled();
  });

  it("opens the tab of an unlocked phase, and never of a locked one", () => {
    const onPhaseClick = vi.fn();
    render(<StudioStages flow={inBuild} onPhaseClick={onPhaseClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Kickoff/ })); // finished: can step back
    expect(onPhaseClick).toHaveBeenLastCalledWith("messages");
    fireEvent.click(screen.getByRole("button", { name: /Build/ }));
    expect(onPhaseClick).toHaveBeenLastCalledWith("tasks");
    fireEvent.click(screen.getByRole("button", { name: /Wrap/ })); // locked
    expect(onPhaseClick).toHaveBeenCalledTimes(2);
  });

  it("flags a stage as done once both of its phases are complete", () => {
    render(
      <StudioStages
        flow={{ ...inBuild, currentPhaseId: "wrap", phaseStatus: { kickoff: "complete", build: "complete", wrap: "current", complete: "todo" } }}
        onPhaseClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Make stage" })).toHaveAttribute("data-state", "done");
    expect(screen.getByRole("region", { name: "Deliver stage" })).toHaveAttribute("data-state", "current");
  });

  it("keeps the overall progress and the pin control", () => {
    const onPinStage = vi.fn();
    render(<StudioStages flow={inBuild} onPhaseClick={vi.fn()} onPinStage={onPinStage} />);
    expect(screen.getByText("45% through Studio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pin/ }));
    expect(onPinStage).toHaveBeenCalledWith(inBuild.currentStageId);
  });

  it("puts a Kreto mascot in each stage (the typing one is decorative)", () => {
    render(<StudioStages flow={baseFlow} onPhaseClick={vi.fn()} />);
    const make = screen.getByRole("region", { name: "Make stage" });
    expect(make.querySelectorAll('[aria-hidden="true"] img[src*="kreto-launcher"]').length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Deliver stage" }).querySelector('img[src*="k-mark"]')).toBeInTheDocument();
  });

  it("no longer carries the Move-to action inside the stages", () => {
    render(<StudioStages flow={{ ...baseFlow, canAdvance: true }} onPhaseClick={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Move to/i })).not.toBeInTheDocument();
  });
});

describe("StudioMoveDock — Move to… docked bottom-right", () => {
  it("names the destination and fires when advancing is allowed", () => {
    const onValidateStep = vi.fn();
    render(<StudioMoveDock flow={{ ...baseFlow, canAdvance: true }} onValidateStep={onValidateStep} />);
    const cta = screen.getByRole("button", { name: /Move to Build/i });
    expect(cta).toBeEnabled();
    expect(screen.getByText(/One click moves this Project into Build/)).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onValidateStep).toHaveBeenCalledTimes(1);
  });

  it("is disabled and explains why until the current stage is satisfied", () => {
    const onValidateStep = vi.fn();
    render(<StudioMoveDock flow={{ ...baseFlow, canAdvance: false }} onValidateStep={onValidateStep} />);
    const cta = screen.getByRole("button", { name: /Move to Build/i });
    expect(cta).toBeDisabled();
    expect(screen.getAllByText("Add a brief to move on").length).toBeGreaterThan(0);
    fireEvent.click(cta);
    expect(onValidateStep).not.toHaveBeenCalled();
  });

  it("uses the canonical branded CTA, not a plain button", () => {
    render(<StudioMoveDock flow={{ ...baseFlow, canAdvance: true }} onValidateStep={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Move to Build/i })).toHaveClass("cta-solid");
  });

  it("is docked at the bottom-right, clear of the Kreto launcher", () => {
    render(<StudioMoveDock flow={{ ...baseFlow, canAdvance: true }} onValidateStep={vi.fn()} />);
    const dock = screen.getByRole("region", { name: "Next phase" });
    expect(dock).toHaveClass("fixed", "right-3", "lg:right-[8.25rem]", "lg:bottom-5");
  });

  it("names the next phase from wherever you are, and disappears once Complete", () => {
    const { rerender } = render(<StudioMoveDock flow={{ ...inBuild, canAdvance: true }} onValidateStep={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Move to Wrap/i })).toBeInTheDocument();

    rerender(
      <StudioMoveDock
        flow={{ ...inBuild, currentPhaseId: "complete", phaseStatus: { kickoff: "complete", build: "complete", wrap: "complete", complete: "current" } }}
        onValidateStep={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Move to/i })).not.toBeInTheDocument();
  });
});
