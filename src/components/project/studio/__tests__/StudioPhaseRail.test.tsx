import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StudioPhaseRail } from "../StudioPhaseRail";
import type { ProjectFlow } from "@/hooks/useProjectFlow";

/**
 * Regression coverage for the Studio "simplify + explicit CTA" pass:
 * the Validate button was promoted from a plain small Button to the
 * canonical CtaButton (.cta-solid), and its label changed from naming the
 * phase being left ("Validate 'Kickoff'") to naming the phase one click
 * actually moves the Project into ("Move to Build"), so the button alone
 * answers "what happens if I press this?"
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

describe("StudioPhaseRail — explicit, branded validation CTA", () => {
  it("names the destination phase, not just the one being left, when advancing is allowed", () => {
    render(
      <StudioPhaseRail
        flow={{ ...baseFlow, canAdvance: true }}
        onPhaseClick={vi.fn()}
        onValidateStep={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Move to Build/i })).toBeEnabled();
    expect(screen.getByText("One click moves this Project into Build.")).toBeInTheDocument();
  });

  it("disables the CTA and explains why, without letting the user skip ahead", () => {
    render(
      <StudioPhaseRail
        flow={{ ...baseFlow, canAdvance: false }}
        onPhaseClick={vi.fn()}
        onValidateStep={vi.fn()}
      />,
    );
    const cta = screen.getByRole("button", { name: /Move to Build/i });
    expect(cta).toBeDisabled();
    expect(screen.getByText("Add a brief to move on")).toBeInTheDocument();
  });

  it("uses the canonical branded CTA treatment (cta-solid), not a plain button", () => {
    render(
      <StudioPhaseRail
        flow={{ ...baseFlow, canAdvance: true }}
        onPhaseClick={vi.fn()}
        onValidateStep={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Move to Build/i })).toHaveClass("cta-solid");
  });

  it("fires onValidateStep on click when advancing is allowed", () => {
    const onValidateStep = vi.fn();
    render(
      <StudioPhaseRail
        flow={{ ...baseFlow, canAdvance: true }}
        onPhaseClick={vi.fn()}
        onValidateStep={onValidateStep}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Move to Build/i }));
    expect(onValidateStep).toHaveBeenCalledTimes(1);
  });

  it("names Complete as the destination from the last real phase (Wrap)", () => {
    render(
      <StudioPhaseRail
        flow={{ ...baseFlow, currentPhaseId: "wrap", canAdvance: true }}
        onPhaseClick={vi.fn()}
        onValidateStep={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Move to Complete/i })).toBeInTheDocument();
  });

  it("hides the CTA entirely once the Project has reached Complete", () => {
    render(
      <StudioPhaseRail
        flow={{ ...baseFlow, currentPhaseId: "complete", canAdvance: true }}
        onPhaseClick={vi.fn()}
        onValidateStep={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Move to/i })).not.toBeInTheDocument();
  });

  it("still gates a locked (todo) phase marker behind a lock and disabled state", () => {
    render(
      <StudioPhaseRail
        flow={baseFlow}
        onPhaseClick={vi.fn()}
        onValidateStep={vi.fn()}
      />,
    );
    // Accessible name comes from the marker's own visible text ("Build"),
    // not its `title` -- text content wins over title in accessible-name
    // computation whenever both are present.
    const buildMarker = screen.getByRole("button", { name: "Build" });
    expect(buildMarker).toBeDisabled();
    expect(buildMarker).toHaveAttribute("title", "Build — complete the earlier steps first");
  });
});
