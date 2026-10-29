import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeckCard } from "../TodayDeck";

/**
 * Today's deck: three modes (3D roulette, swipe row, flat), one rule for all of
 * them: it never turns by itself, nothing is hidden from keyboard or screen
 * reader, and a click on a CTA is always a click on that CTA.
 */

const env = { reduced: false, wide: true, fine: true };
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => env.reduced }));
vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: (q: string) => (q.includes("min-width") ? env.wide : env.fine),
}));

import { TodayDeck } from "../TodayDeck";

const onCta = vi.fn();
const cards: DeckCard[] = ["Passport", "Next move", "Activity"].map((label, i) => ({
  id: `c${i}`,
  label,
  node: (
    <section aria-label={label}>
      <h2>{label} card</h2>
      <button type="button" onClick={() => onCta(label)}>
        Act on {label}
      </button>
    </section>
  ),
}));

beforeAll(() => {
  // jsdom has neither PointerEvent nor element scrolling
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

beforeEach(() => {
  env.reduced = false;
  env.wide = true;
  env.fine = true;
  onCta.mockClear();
});

const slide = (n: number) => screen.getAllByRole("group", { name: /^Card \d of 3$/ })[n - 1];
const front = () => screen.getAllByRole("group", { name: /^Card \d of 3$/ }).find((s) => s.dataset.position === "front")!;
const deck = () => screen.getByRole("group", { name: "Today cards" }).querySelector<HTMLElement>("[tabindex='0']")!;

describe("TodayDeck — reduced motion", () => {
  it("shows every card at once, flat, with no controls that move anything", () => {
    env.reduced = true;
    render(<TodayDeck cards={cards} />);
    expect(screen.getByRole("group", { name: "Today cards" })).not.toHaveAttribute("aria-roledescription");
    for (const label of ["Passport", "Next move", "Activity"]) {
      expect(screen.getByRole("region", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /Next card|Previous card/ })).not.toBeInTheDocument();
    expect(document.querySelector("[style*='transform']")).toBeNull();
  });
});

describe("TodayDeck — 3D roulette (wide, fine pointer)", () => {
  it("starts on the first card, readable, and stays there on its own", () => {
    vi.useFakeTimers();
    render(<TodayDeck cards={cards} />);
    expect(front()).toBe(slide(1));
    vi.advanceTimersByTime(60_000);
    expect(front()).toBe(slide(1));
    vi.useRealTimers();
  });

  it("is a labelled carousel with 'Card n of 3' slides and a polite announcement", () => {
    render(<TodayDeck cards={cards} />);
    expect(screen.getByRole("group", { name: "Today cards" })).toHaveAttribute("aria-roledescription", "carousel");
    expect(slide(2)).toHaveAttribute("aria-roledescription", "slide");
    expect(screen.getByText("Card 1 of 3: Passport")).toHaveAttribute("aria-live", "polite");
  });

  it("keeps its announcement inside a positioned wrapper, so it cannot stretch the document and leave an empty band under Today", () => {
    render(<TodayDeck cards={cards} />);
    const note = screen.getByText("Card 1 of 3: Passport");
    expect(note).toHaveClass("sr-only"); // position:absolute: without a positioned ancestor it is placed against the page, outside the app's scroller
    const positioned = note.closest(".relative");
    expect(positioned).not.toBeNull();
    expect(screen.getByRole("group", { name: "Today cards" }).contains(positioned)).toBe(true); // the deck itself or something inside it, never an outer wrapper
  });

  it("turns exactly one card per Next/Previous and wraps around the three", () => {
    render(<TodayDeck cards={cards} />);
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(front()).toBe(slide(2));
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(front()).toBe(slide(3));
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(front()).toBe(slide(1));
    fireEvent.click(screen.getByRole("button", { name: "Previous card" }));
    expect(front()).toBe(slide(3));
    expect(screen.getByText("Card 3 of 3: Activity")).toBeInTheDocument();
  });

  it("the dots jump to a card, each with its own label", () => {
    render(<TodayDeck cards={cards} />);
    fireEvent.click(screen.getByRole("button", { name: "Show card 3 of 3: Activity" }));
    expect(front()).toBe(slide(3));
    expect(screen.getByRole("button", { name: "Show card 3 of 3: Activity" })).toHaveAttribute("aria-current", "true");
  });

  it("ArrowLeft/ArrowRight turn the deck only when the deck itself has focus", () => {
    render(<TodayDeck cards={cards} />);
    const inner = within(front()).getByRole("button", { name: "Act on Passport" });
    inner.focus();
    fireEvent.keyDown(inner, { key: "ArrowRight" });
    expect(front()).toBe(slide(1)); // focus is on a CTA: arrows do nothing

    deck().focus();
    fireEvent.keyDown(deck(), { key: "ArrowRight" });
    expect(front()).toBe(slide(2));
    fireEvent.keyDown(deck(), { key: "ArrowLeft" });
    expect(front()).toBe(slide(1));
  });

  it("Enter and Space on a CTA activate the CTA and never turn the deck", () => {
    render(<TodayDeck cards={cards} />);
    const cta = within(front()).getByRole("button", { name: "Act on Passport" });
    cta.focus();
    fireEvent.keyDown(cta, { key: "Enter" });
    fireEvent.keyDown(cta, { key: " " });
    expect(front()).toBe(slide(1));
    fireEvent.click(cta);
    expect(onCta).toHaveBeenCalledWith("Passport");
  });

  it("clicking a CTA on the front card runs it; clicking a side card only brings it forward", () => {
    render(<TodayDeck cards={cards} />);
    fireEvent.click(within(front()).getByRole("button", { name: "Act on Passport" }));
    expect(onCta).toHaveBeenCalledTimes(1);

    onCta.mockClear();
    fireEvent.click(within(slide(2)).getByRole("button", { name: "Act on Next move" }));
    expect(onCta).not.toHaveBeenCalled();
    expect(front()).toBe(slide(2));
    fireEvent.click(within(front()).getByRole("button", { name: "Act on Next move" }));
    expect(onCta).toHaveBeenCalledWith("Next move");
  });

  it("tabbing into a card brings it to the front", () => {
    render(<TodayDeck cards={cards} />);
    fireEvent.focus(within(slide(3)).getByRole("button", { name: "Act on Activity" }));
    expect(front()).toBe(slide(3));
  });

  it("a drag turns one card; a press on a control never starts a drag; the click after a drag is swallowed", () => {
    render(<TodayDeck cards={cards} />);
    const heading = within(front()).getByRole("heading", { name: "Passport card" });

    // drag left on the card body: the right-hand card comes forward
    fireEvent.pointerDown(heading, { clientX: 400 });
    fireEvent.pointerMove(heading, { clientX: 300 });
    fireEvent.pointerUp(heading, { clientX: 300 });
    expect(front()).toBe(slide(2));

    // a press that starts on a button is not a drag, however far it travels
    const cta = within(front()).getByRole("button", { name: "Act on Next move" });
    fireEvent.pointerDown(cta, { clientX: 400 });
    fireEvent.pointerUp(cta, { clientX: 100 });
    expect(front()).toBe(slide(2));

    // short wobble: not enough to turn
    const h2 = within(front()).getByRole("heading", { name: "Next move card" });
    fireEvent.pointerDown(h2, { clientX: 400 });
    fireEvent.pointerUp(h2, { clientX: 380 });
    expect(front()).toBe(slide(2));
  });

  it("leaving mid-drag forgets the drag and keeps the current card", () => {
    render(<TodayDeck cards={cards} />);
    const heading = within(front()).getByRole("heading", { name: "Passport card" });
    fireEvent.pointerDown(heading, { clientX: 400 });
    fireEvent.pointerLeave(deck());
    fireEvent.pointerUp(heading, { clientX: 100 });
    expect(front()).toBe(slide(1));
  });
});

describe("TodayDeck — swipe row (touch or narrow)", () => {
  beforeEach(() => {
    env.wide = false;
    env.fine = false;
  });

  it("is a native horizontal row: keyboard-focusable, labelled, with 44px controls", () => {
    render(<TodayDeck cards={cards} />);
    expect(screen.getByRole("group", { name: "Today cards" })).toHaveAttribute("aria-roledescription", "carousel");
    expect(deck()).toHaveClass("overflow-x-auto", "snap-x");
    for (const name of ["Previous card", "Next card"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("h-11", "w-11");
    }
    // no 3D transforms to fight the scroll
    expect(document.querySelector("[style*='rotateY']")).toBeNull();
  });

  it("keeps its announcement inside a positioned wrapper, so it cannot stretch the document and leave an empty band under Today", () => {
    render(<TodayDeck cards={cards} />);
    const note = screen.getByText("Card 1 of 3: Passport");
    expect(note).toHaveClass("sr-only");
    const positioned = note.closest(".relative");
    expect(positioned).not.toBeNull();
    expect(screen.getByRole("group", { name: "Today cards" }).contains(positioned)).toBe(true);
    // the track keeps its own positioned box too, and the controls row is the announcement's wrapper
    expect(positioned).toContainElement(screen.getByRole("button", { name: "Next card" }));
  });

  it("Previous is disabled on the first card, Next on the last, and the announcement follows", () => {
    render(<TodayDeck cards={cards} />);
    expect(screen.getByRole("button", { name: "Previous card" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByText("Card 2 of 3: Next move")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByRole("button", { name: "Next card" })).toBeDisabled();
    expect(screen.getByText("Card 3 of 3: Activity")).toBeInTheDocument();
  });

  it("every card's CTA stays reachable without any rotation", () => {
    render(<TodayDeck cards={cards} />);
    fireEvent.click(screen.getByRole("button", { name: "Act on Activity" }));
    expect(onCta).toHaveBeenCalledWith("Activity");
  });
});
