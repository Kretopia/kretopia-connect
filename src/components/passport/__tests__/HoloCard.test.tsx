import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoloCard } from "../HoloCard";

// jsdom has no PointerEvent, and without it clientX/clientY are dropped from the events below.
class TestPointerEvent extends MouseEvent {}

function setup(props: Partial<React.ComponentProps<typeof HoloCard>> = {}) {
  const view = render(<HoloCard {...props}><p>card body</p></HoloCard>);
  const wrapper = view.container.firstElementChild as HTMLElement;
  const card = wrapper.firstElementChild as HTMLElement;
  return { view, wrapper, card };
}
const everyElement = (root: HTMLElement) => [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

describe("HoloCard", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never;
    vi.stubGlobal("PointerEvent", TestPointerEvent);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the card's content and shows the foil on every card, without anything touching it", () => {
    const { card } = setup();
    expect(screen.getByText("card body")).toBeTruthy();
    const foil = card.querySelector<HTMLElement>(".mix-blend-soft-light");
    expect(foil).not.toBeNull();
    expect(Number(foil!.style.opacity)).toBeGreaterThan(0.2);
  });

  // The trembling near a corner came from a tilt that moved the card's own edge from under the pointer. Nothing tilts
  // now, so there is nothing to move: no element gets a transform from the pointer, however it moves.
  it("never gives any part of the card a transform from the pointer, at a corner or anywhere else", () => {
    const { wrapper, card } = setup();
    const before = everyElement(wrapper).map((el) => el.getAttribute("style"));

    for (const [x, y] of [[0, 0], [1, 1], [199, 1], [1, 99], [199, 99], [100, 50], [-300, 900]]) {
      fireEvent.pointerMove(card, { clientX: x, clientY: y });
      fireEvent.pointerMove(wrapper, { clientX: x, clientY: y });
      fireEvent.pointerOut(card, { relatedTarget: wrapper });
      fireEvent.pointerOut(wrapper, { relatedTarget: document.body });
    }

    expect(everyElement(wrapper).map((el) => el.getAttribute("style"))).toEqual(before);
    expect(card.getAttribute("style")).toBeNull();
  });

  it("has no rotating hit target: no perspective, 3D transform style or transform transition on the wrapper or the card", () => {
    const { wrapper, card } = setup();
    for (const el of [wrapper, card]) {
      expect(el.className).not.toMatch(/perspective|preserve-3d|transition-transform|will-change-transform/);
    }
  });

  it("accepts a tilt amplitude only for old callers and ignores it", () => {
    const { wrapper, card } = setup({ maxTilt: 12 });
    fireEvent.pointerMove(card, { clientX: 3, clientY: 4 });
    expect(everyElement(wrapper).some((el) => /rotate|translate|scale/.test(el.getAttribute("style") ?? ""))).toBe(false);
  });

  it("is the same card with the glow off, and keeps the caller's own className on the wrapper", () => {
    const { wrapper } = setup({ glow: false, className: "h-full w-44" });
    expect(wrapper.className).toBe("h-full w-44");
    expect(wrapper.querySelector(".ai-ambient-breathe")).toBeNull();
    expect(screen.getByText("card body")).toBeTruthy();
  });
});
