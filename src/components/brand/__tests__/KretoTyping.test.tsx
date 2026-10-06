import { render, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KretoTyping } from "../KretoTyping";

/** jsdom has no Web Animations API and never decodes images: stub both. */
let animate: ReturnType<typeof vi.fn>;
let finishers: Array<() => void>;

const mockMatchMedia = (reduce: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({
      matches: reduce && q.includes("reduce"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });

beforeEach(() => {
  finishers = [];
  animate = vi.fn(function (this: HTMLElement) {
    const anim: any = { cancel: vi.fn(), onfinish: null, oncancel: null };
    finishers.push(() => anim.onfinish?.());
    return anim;
  });
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => 1024 });
  mockMatchMedia(false);
});

afterEach(() => {
  delete (HTMLElement.prototype as any).animate;
});

const root = (c: HTMLElement) => c.firstElementChild as HTMLElement;

describe("KretoTyping", () => {
  it("is decorative and renders Kreto once plus one cut-out per glove, all from the same art", () => {
    const { container } = render(<KretoTyping />);
    expect(root(container)).toHaveAttribute("aria-hidden", "true");
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(3);
    expect(new Set(imgs.map((i) => i.getAttribute("src"))).size).toBe(1);
    expect(imgs.every((i) => i.getAttribute("alt") === "")).toBe(true);
    // the two glove layers are clipped to their hand, the base is not
    expect(imgs.filter((i) => i.style.clipPath).length).toBe(2);
  });

  it("types on hover: both hands, the lid glow and the key sparks", () => {
    const { container } = render(<KretoTyping />);
    fireEvent.pointerEnter(root(container));
    // 2 gloves + 1 glow + 6 sparks
    expect(animate).toHaveBeenCalledTimes(9);
    const gloveCalls = animate.mock.calls.filter(([frames]) => frames[0]?.transform?.startsWith("translateY"));
    expect(gloveCalls).toHaveLength(2);
  });

  it("plays one burst at a time, then again after it finishes", () => {
    const { container } = render(<KretoTyping />);
    fireEvent.pointerEnter(root(container));
    fireEvent.pointerEnter(root(container));
    fireEvent.pointerDown(root(container));
    expect(animate).toHaveBeenCalledTimes(9);

    act(() => finishers[0]());
    fireEvent.pointerDown(root(container)); // touch
    expect(animate).toHaveBeenCalledTimes(18);
  });

  it("does not move at all when the user prefers reduced motion", () => {
    mockMatchMedia(true);
    const { container } = render(<KretoTyping />);
    fireEvent.pointerEnter(root(container));
    fireEvent.pointerDown(root(container));
    expect(animate).not.toHaveBeenCalled();
  });

  it("waits until the image is decoded before showing or animating", () => {
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => 0 });
    const { container } = render(<KretoTyping />);
    fireEvent.pointerEnter(root(container));
    expect(animate).not.toHaveBeenCalled();
    expect(root(container).firstElementChild).toHaveClass("opacity-0");
  });
});
