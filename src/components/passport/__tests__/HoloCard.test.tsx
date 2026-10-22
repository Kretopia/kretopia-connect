import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoloCard } from "../HoloCard";

// jsdom has no PointerEvent, and without it clientX/clientY are dropped from the events below.
class TestPointerEvent extends MouseEvent {}

const media = (reduced: boolean, fine = true) =>
  vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? reduced : fine,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

function setup(props: Partial<React.ComponentProps<typeof HoloCard>> = {}) {
  const view = render(<HoloCard {...props}><p>card body</p></HoloCard>);
  const wrapper = view.container.firstElementChild as HTMLElement;
  const tilted = wrapper.firstElementChild as HTMLElement;
  // The wrapper is a 200 x 100 box at the origin, as a real laid-out card would be.
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) });
  return { wrapper, tilted };
}
const angles = (el: HTMLElement) => {
  const m = el.style.transform.match(/rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};
const move = (el: HTMLElement, clientX: number, clientY: number) => fireEvent.pointerMove(el, { clientX, clientY });

describe("HoloCard", () => {
  beforeEach(() => {
    window.matchMedia = media(false);
    vi.stubGlobal("PointerEvent", TestPointerEvent);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the card's content and shows the foil even before anything touches it", () => {
    const { tilted } = setup();
    expect(screen.getByText("card body")).toBeTruthy();
    const foil = tilted.querySelector<HTMLElement>(".mix-blend-soft-light");
    expect(foil).not.toBeNull();
    expect(Number(foil!.style.opacity)).toBeGreaterThan(0.2);
    expect(angles(tilted)).toEqual({ x: 0, y: 0 });
  });

  it("tilts towards the pointer by at most the default amplitude, which is gentle", () => {
    const { wrapper, tilted } = setup();
    move(wrapper, 0, 0);
    expect(angles(tilted)).toEqual({ x: 5, y: -5 });
    move(wrapper, 200, 100);
    expect(angles(tilted)).toEqual({ x: -5, y: 5 });
  });

  it("never tilts further than the amplitude, whatever the pointer reports outside the card", () => {
    const { wrapper, tilted } = setup({ maxTilt: 4 });
    move(wrapper, -500, 900);
    expect(Math.abs(angles(tilted)!.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(angles(tilted)!.y)).toBeLessThanOrEqual(4);
  });

  // The trembling near a corner: the pointer used to be tracked on the tilted card itself, so the tilt moved the card's
  // edge from under the pointer, which reset the tilt, which put the pointer back over the card, and so on.
  it("does not reset when the tilted card's own edge leaves the pointer: only leaving the stable wrapper does", () => {
    const { wrapper, tilted } = setup();
    move(wrapper, 2, 2);
    const held = angles(tilted);
    expect(held).not.toEqual({ x: 0, y: 0 });

    // The pointer moves from the tilted card to its stable wrapper: it has not left the card's area.
    fireEvent.pointerOut(tilted, { relatedTarget: wrapper });
    expect(angles(tilted)).toEqual(held);

    // Only leaving the wrapper itself puts the card flat again.
    fireEvent.pointerOut(wrapper, { relatedTarget: document.body });
    expect(angles(tilted)).toEqual({ x: 0, y: 0 });
  });

  it("is the same tilt for the same pointer position, however many events arrive (no oscillation)", () => {
    const { wrapper, tilted } = setup();
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) { move(wrapper, 3, 4); seen.add(tilted.style.transform); }
    expect(seen.size).toBe(1);
  });

  it("stays flat for people who prefer reduced motion, and on touch screens", () => {
    window.matchMedia = media(true);
    const reduced = setup();
    move(reduced.wrapper, 0, 0);
    expect(angles(reduced.tilted)).toEqual({ x: 0, y: 0 });
    cleanup();

    window.matchMedia = media(false, false);
    const touch = setup();
    move(touch.wrapper, 0, 0);
    expect(angles(touch.tilted)).toEqual({ x: 0, y: 0 });
  });

  it("only transforms the card: the tilt is not applied to any size, position or margin", () => {
    const { wrapper, tilted } = setup();
    move(wrapper, 20, 30);
    for (const prop of ["width", "height", "top", "left", "margin", "padding"]) {
      expect(tilted.style.getPropertyValue(prop)).toBe("");
    }
    expect(tilted.getAttribute("style")).toMatch(/^transform:/);
  });
});
