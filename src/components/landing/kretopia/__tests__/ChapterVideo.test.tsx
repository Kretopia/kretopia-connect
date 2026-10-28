import { act, cleanup, fireEvent, render } from "@testing-library/react";
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

function chapter(index: string, videoWebm?: string) {
  const view = render(
    <MemoryRouter>
      <ChapterSection index={index} kicker="Kicker" title="Title" body="Body" caption="Caption" image="/x.jpg" video="/videos/x.mp4" videoWebm={videoWebm} accent="red" href="/x" />
    </MemoryRouter>,
  );
  const video = view.container.querySelector("video");
  if (!video) throw new Error("Chapter video missing");
  return video;
}

function observer(predicate: (o: Observed) => boolean) {
  const found = observers.find(predicate);
  if (!found) throw new Error("Observer missing");
  return found;
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
      expect(video.preload).toBe("none");
      cleanup();
    }
  });

  describe("the first chapter on a phone or with data saver on", () => {
    const phone = () => vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width: 767px"), media: q, addEventListener() {}, removeEventListener() {} }));

    it("warms the first chapter immediately on a phone without data saver", () => {
      phone();
      const video = chapter("II");
      expect(video.hasAttribute("autoplay")).toBe(true);
      expect(video.preload).toBe("auto");
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    });

    it("still starts, and promotes its download a screen ahead, once the person reaches it", () => {
      phone();
      const video = chapter("II");
      enter(observer((o) => o.options?.rootMargin === "200% 0px"), true);
      expect(video.preload).toBe("auto");
      enter(observer((o) => o.options?.threshold === 0.25), true);
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });

    it("waits with data saver on, whatever the screen", () => {
      vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
      Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
      try {
        const video = chapter("II");
        expect(video.hasAttribute("autoplay")).toBe(false);
        expect(video.preload).toBe("none");
      } finally {
        Reflect.deleteProperty(navigator, "connection");
      }
    });

    it("is unchanged on a wide screen with no data saver: the first chapter is fetched and started right away", () => {
      vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
      const video = chapter("II");
      expect(video.hasAttribute("autoplay")).toBe(true);
      expect(video.preload).toBe("auto");
    });
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

  it("promotes the download from none to full two screens before the chapter is reached", () => {
    const video = chapter("III");
    const near = observer((o) => o.options?.rootMargin === "200% 0px");
    expect(near).toBeTruthy();
    enter(near, false);
    expect(video.preload).toBe("none");
    enter(near, true);
    expect(video.preload).toBe("auto");
  });

  it("starts a lower chapter when it comes into view, and pauses it when it leaves", () => {
    chapter("III");
    const watch = observer((o) => o.options?.threshold === 0.25);
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
    const watch = observer((o) => o.options?.threshold === 0.25);
    await act(async () => { enter(watch, true); });
    expect(view.getByRole("button", { name: "Play the Scout video" })).toBeTruthy();
  });
  it("does not restart resource selection when warming or returning to a chapter", () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    chapter("III");
    enter(observer((o) => o.options?.rootMargin === "200% 0px"), true);
    const watch = observer((o) => o.options?.threshold === 0.25);
    enter(watch, true);
    enter(watch, false);
    enter(watch, true);
    expect(load).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it("offers both native formats without fetching a third src", () => {
    const video = chapter("II", "/videos/x.webm");
    expect(video.hasAttribute("src")).toBe(false);
    const sources = [...video.querySelectorAll("source")];
    expect(sources.map((s) => s.type)).toEqual(["video/mp4", "video/webm"]);
    expect(sources.map((s) => s.getAttribute("src"))).toEqual(["/videos/x.mp4", "/videos/x.webm"]);
  });

  it("does not confuse a scroll-cancelled play with an autoplay refusal", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new DOMException("interrupted", "AbortError"));
    const video = chapter("III");
    await act(async () => enter(observer((o) => o.options?.threshold === 0.25), true));
    expect(video.parentElement?.querySelector("button")).toBeNull();
  });

  it("cleans up gesture retries even when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    chapter("II");
    cleanup();
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    fireEvent.pointerDown(window);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

});
