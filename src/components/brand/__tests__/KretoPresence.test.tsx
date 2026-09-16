import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KretoPresence } from "../KretoPresence";

/**
 * Regression coverage for Kreto's global embodied-presence system
 * (KRETO_STATE_MACHINE_REPORT.md, building on the pilot's
 * KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md): the component itself must
 * support the full real state set without inventing any of it, stay
 * decorative by default, become a real accessible control only when given
 * onClick, never let a cosmetic hover state paper over a real one, and
 * never throw under reduced motion.
 */

let reducedMotion = false;
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion,
}));

describe("KretoPresence", () => {
  it("is decorative (aria-hidden) by default with no accessible name", () => {
    const { container } = render(<KretoPresence />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("becomes a real accessible button when onClick + label are provided", () => {
    const onClick = vi.fn();
    render(<KretoPresence onClick={onClick} label="Open Kreto" />);
    const button = screen.getByRole("button", { name: "Open Kreto" });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("falls back to a default accessible name if onClick is given without a label", () => {
    render(<KretoPresence onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Open Kreto" })).toBeInTheDocument();
  });

  it("idle state renders no state announcement (nothing to announce)", () => {
    const { container } = render(<KretoPresence state="idle" />);
    expect(container.querySelector(".sr-only")).not.toBeInTheDocument();
  });

  it.each([
    ["listening", "Kreto is listening"],
    ["processing", "Kreto is working on this"],
    ["proposal_ready", "Kreto has a suggestion ready"],
    ["success", "Kreto completed the action"],
    ["caution", "Kreto needs you to review something before it continues"],
    ["error", "Kreto needs your attention"],
    ["offline", "Kreto is unavailable right now"],
  ] as const)("state=%s exposes the real text announcement '%s'", (state, label) => {
    render(<KretoPresence state={state} />);
    expect(screen.getByText(label)).toHaveClass("sr-only");
  });

  it("renders the real KretoMark badge at compact/card/hero/full sizes but not at micro", () => {
    const { container: micro } = render(<KretoPresence size="micro" />);
    const { container: compact } = render(<KretoPresence size="compact" />);
    const { container: card } = render(<KretoPresence size="card" />);
    const { container: hero } = render(<KretoPresence size="hero" />);
    const { container: full } = render(<KretoPresence size="full" />);
    expect(micro.querySelector("img")).not.toBeInTheDocument();
    expect(compact.querySelector("img")).toBeInTheDocument();
    expect(card.querySelector("img")).toBeInTheDocument();
    expect(hero.querySelector("img")).toBeInTheDocument();
    expect(full.querySelector("img")).toBeInTheDocument();
  });

  it("hover on an interactive idle control shows the attentive announcement gap (no forced text) without throwing", () => {
    const { container } = render(<KretoPresence onClick={() => {}} state="idle" />);
    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);
    // attentive has no sr-only announcement by design -- it's a hover
    // micro-affordance on a control that already has its own aria-label.
    expect(container.querySelector(".sr-only")).not.toBeInTheDocument();
    fireEvent.mouseLeave(button);
  });

  it("hovering a control that is genuinely processing keeps announcing processing, not a fake attentive/idle look", () => {
    render(<KretoPresence onClick={() => {}} state="processing" />);
    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);
    expect(screen.getByText("Kreto is working on this")).toHaveClass("sr-only");
  });

  it("does not throw and renders statically under prefers-reduced-motion", () => {
    reducedMotion = true;
    expect(() => render(<KretoPresence state="processing" />)).not.toThrow();
    reducedMotion = false;
  });

  it("renders exactly one signal-dot circle regardless of state", () => {
    const { container } = render(<KretoPresence state="processing" />);
    // One "signal" circle plus its outline stroke circle = 2 <circle> elements.
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });
});
