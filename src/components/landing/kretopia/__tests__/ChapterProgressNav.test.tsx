import { act, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChapterProgressNav } from "../ChapterProgressNav";
import { CHAPTER_REGISTRY } from "../chapterRegistry";

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));

describe("Landing chapter marks", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("elongates only the active mark and navigates smoothly", () => {
    const observers: IntersectionObserverCallback[] = [];
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { observers.push(callback); }
      observe() {}
      disconnect() {}
    });
    const { container } = render(<>
      <div id="kretopia-hero" />
      {CHAPTER_REGISTRY.map(chapter => <section key={chapter.id} id={chapter.id} />)}
      <ChapterProgressNav ready />
    </>);
    const match = container.querySelector("#chapter-match");
    if (!match) throw new Error("Match chapter missing");
    act(() => {
      observers[0]([{ isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver);
      observers[1]([{ isIntersecting: true, target: match }] as IntersectionObserverEntry[], {} as IntersectionObserver);
    });
    const button = screen.getByRole("button", { name: "Jump to Match chapter" });
    expect(button).toHaveAttribute("aria-current", "true");
    expect(button.querySelector('[aria-hidden]')).toHaveClass("h-6", "bg-foreground");
    expect(container.querySelectorAll('button[aria-current="true"]')).toHaveLength(1);
    // only the active mark is long: every other mark is the short dot
    const marks = Array.from(container.querySelectorAll<HTMLElement>('button[aria-label^="Jump to"] [aria-hidden]'));
    const long = marks.filter((m) => m.classList.contains("h-6"));
    expect(long).toHaveLength(1);
    expect(marks.filter((m) => m.classList.contains("h-1.5")).length).toBe(marks.length - 1);
    const scroll = vi.fn();
    match.scrollIntoView = scroll;
    fireEvent.click(button);
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});