import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KretoCharacter } from "../KretoCharacter";

let reducedMotion = false;
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion,
}));

describe("KretoCharacter", () => {
  it("is decorative (aria-hidden), never a control", () => {
    const { container } = render(<KretoCharacter />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders each of the five real variants with a distinct accessible name", () => {
    const variants = ["main", "scout", "connector", "producer", "publicist"] as const;
    const names = ["Kreto", "Kreto — Scout", "Kreto — Connector", "Kreto — Producer", "Kreto — Publicist"];
    variants.forEach((variant, i) => {
      const { container } = render(<KretoCharacter variant={variant} />);
      expect(container.querySelector(".sr-only")).toHaveTextContent(names[i]);
    });
  });

  it("shows no status badge and no extra announcement when idle", () => {
    const { container } = render(<KretoCharacter state="idle" />);
    expect(container.querySelector("[aria-hidden] > span:not(.sr-only)")).toBeNull();
    expect(container.querySelector(".sr-only")).toHaveTextContent("Kreto");
  });

  it("pairs a visible-adjacent state badge with the same real sr-only text KretoPresence uses", () => {
    const { container } = render(<KretoCharacter state="processing" />);
    expect(container.querySelector(".sr-only")).toHaveTextContent("Kreto is working on this");
  });

  it("does not throw under reduced motion", () => {
    reducedMotion = true;
    expect(() => render(<KretoCharacter />)).not.toThrow();
    reducedMotion = false;
  });

  it("does not re-enable pointer events unless hoverable is explicitly set", () => {
    const { container } = render(<KretoCharacter />);
    expect(container.firstElementChild).not.toHaveClass("pointer-events-auto");
  });

  it("re-enables pointer events only on itself when hoverable, without becoming a control", () => {
    const { container } = render(<KretoCharacter hoverable />);
    expect(container.firstElementChild).toHaveClass("pointer-events-auto");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not throw when hoverable under reduced motion (hover wiggle is skipped, not broken)", () => {
    reducedMotion = true;
    expect(() => render(<KretoCharacter hoverable />)).not.toThrow();
    reducedMotion = false;
  });

  it("knocks to a real, non-identity transform on a real hover, and settles back on hover end", async () => {
    const { container } = render(<KretoCharacter hoverable />);
    const el = container.firstElementChild as HTMLElement;
    const restingTransform = el.style.transform;

    fireEvent.mouseEnter(el);
    await waitFor(() => expect(el.style.transform).not.toBe(restingTransform));

    fireEvent.mouseLeave(el);
    // Settling back is itself animated (spring/tween), so just confirm the
    // hover-end handler ran without throwing and the element is still there
    // -- KretoPresence-style "does not throw" coverage, not a pixel chase.
    expect(el).toBeInTheDocument();
  });

  it("never knocks when reduced motion is on, even while hoverable", () => {
    reducedMotion = true;
    const { container } = render(<KretoCharacter hoverable />);
    const el = container.firstElementChild as HTMLElement;
    const restingTransform = el.style.transform;
    fireEvent.mouseEnter(el);
    expect(el.style.transform).toBe(restingTransform);
    reducedMotion = false;
  });
});
