import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../FeatureTutorialPanel", () => ({ FeatureTutorialPanel: () => null }));
vi.mock("../KretopiaFeatureTutorial", () => ({ KretopiaFeatureTutorial: () => null }));
vi.mock("@/components/brand/KretoCharacter", () => ({ KretoCharacter: () => null }));
vi.mock("@/lib/landingMetrics", () => ({ trackLandingCtaClick: vi.fn() }));

import { ChapterSection } from "../ChapterSection";

interface Observed { callback: IntersectionObserverCallback; options?: IntersectionObserverInit }
let observers: Observed[] = [];

class FakeObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observers.push({ callback, options });
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const enter = (which: Observed, isIntersecting: boolean) =>
  act(() => which.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));

function chapter(index: string) {
  const view = render(
    <MemoryRouter>
      <ChapterSection index={index} kicker="Kicker" title="Title" body="Body" caption="Caption" image="/x.jpg" video="/videos/x.mp4" accent="red" href="/x" />
    </MemoryRouter>,
  );
  return view.container.querySelector("video") as HTMLVideoElement;
}

describe("Landing chapter videos", () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // `autoplay` overrides `preload`: with it on every chapter, a phone started fetching all of the large files at once.
  it("only the first chapter asks the browser to play, and so fetch, by itself", () => {
    const first = chapter("II");
    expect(first.hasAttribute("autoplay")).toBe(true);
    expect(first.preload).toBe("auto");
    cleanup();

    for (const later of ["III", "IV", "V", "VI"]) {
      const video = chapter(later);
      expect(video.hasAttribute("autoplay")).toBe(false);
      expect(video.preload).toBe("metadata");
      cleanup();
    }
  });

  it("keeps every chapter silent, inline and looping, with no still poster", () => {
    const video = chapter("III");
    expect(video.muted).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("poster")).toBe(false);
  });

  it("does not start a lower chapter before it is reached", () => {
    chapter("III");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("promotes the download from metadata to full one screen before the chapter is reached", () => {
    const video = chapter("III");
    const near = observers.find((o) => o.options?.rootMargin === "100% 0px")!;
    expect(near).toBeTruthy();
    enter(near, false);
    expect(video.preload).toBe("metadata");
    enter(near, true);
    expect(video.preload).toBe("auto");
  });

  it("starts a lower chapter when it comes into view, and pauses it when it leaves", () => {
    chapter("III");
    const watch = observers.find((o) => o.options?.threshold === 0.25)!;
    expect(watch).toBeTruthy();

    enter(watch, true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    enter(watch, false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("shows a Play button instead of a blank frame when the browser refuses to play", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.reject(new DOMException("blocked", "NotAllowedError")));
    const view = render(
      <MemoryRouter>
        <ChapterSection index="III" kicker="K" title="T" body="B" caption="Scout" image="/x.jpg" video="/videos/x.mp4" accent="red" href="/x" />
      </MemoryRouter>,
    );
    const watch = observers.find((o) => o.options?.threshold === 0.25)!;
    await act(async () => { enter(watch, true); });
    expect(view.getByRole("button", { name: "Play the Scout video" })).toBeTruthy();
  });
});
