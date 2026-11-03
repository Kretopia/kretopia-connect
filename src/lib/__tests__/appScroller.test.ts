import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_SCROLLER_ATTR, getAppScroller, readScrollTop, restoreScrollTop } from "@/lib/appScroller";

function scroller(height: { scrollHeight: number; clientHeight: number }) {
  const el = document.createElement("div");
  el.setAttribute(APP_SCROLLER_ATTR, "");
  const scrollTo = vi.fn();
  el.scrollTo = scrollTo as unknown as typeof el.scrollTo;
  Object.defineProperty(el, "scrollHeight", { get: () => height.scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { get: () => height.clientHeight, configurable: true });
  document.body.appendChild(el);
  return { el, scrollTo };
}

describe("the app's scroller", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "Date"] }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("finds the shell's scroller by the classes App.tsx gives it, and takes the first one in the document", () => {
    const shell = document.createElement("div");
    shell.className = "h-full overflow-auto overscroll-y-contain";
    const dialog = document.createElement("div"); // portalled after the shell
    dialog.className = "h-full overflow-auto overscroll-y-contain";
    document.body.append(shell, dialog);
    expect(getAppScroller()).toBe(shell);
    shell.scrollTop = 77;
    expect(readScrollTop()).toBe(77);
  });

  it("lets a page mark its own scroller, which wins", () => {
    const shell = document.createElement("div");
    shell.className = "h-full overflow-auto overscroll-y-contain";
    const marked = document.createElement("div");
    marked.setAttribute(APP_SCROLLER_ATTR, "");
    document.body.append(shell, marked);
    expect(getAppScroller()).toBe(marked);
  });

  it("reads the position of the marked div, not the window's", () => {
    const { el } = scroller({ scrollHeight: 2000, clientHeight: 500 });
    el.scrollTop = 321;
    expect(readScrollTop()).toBe(321);
  });

  it("waits for content that arrives late, then stops once the page is tall enough", () => {
    const height = { scrollHeight: 600, clientHeight: 500 };
    const { scrollTo } = scroller(height);
    restoreScrollTop(800);
    vi.advanceTimersByTime(100);
    expect(scrollTo).toHaveBeenCalledWith({ top: 800 });
    const whileShort = scrollTo.mock.calls.length;
    expect(whileShort).toBeGreaterThan(1);

    height.scrollHeight = 3000; // the content has loaded
    vi.advanceTimersByTime(100);
    const afterTall = scrollTo.mock.calls.length;
    vi.advanceTimersByTime(500);
    expect(scrollTo.mock.calls.length).toBe(afterTall);
  });

  it("gives up after the time limit when the page never becomes tall enough", () => {
    const { scrollTo } = scroller({ scrollHeight: 600, clientHeight: 500 });
    restoreScrollTop(800, 300);
    vi.advanceTimersByTime(1000);
    const calls = scrollTo.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(scrollTo.mock.calls.length).toBe(calls);
  });

  it("can be cancelled, and does nothing for a position of zero", () => {
    const { scrollTo } = scroller({ scrollHeight: 600, clientHeight: 500 });
    const stop = restoreScrollTop(800);
    stop();
    vi.advanceTimersByTime(500);
    expect(scrollTo).not.toHaveBeenCalled();
    restoreScrollTop(0);
    vi.advanceTimersByTime(100);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
