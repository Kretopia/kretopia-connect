/**
 * The app's one scroller is a div in App.tsx, not the window (html and body are locked so a stray element cannot drag the app up).
 * Anything that reads or restores a scroll position has to talk to that div. It is found by the three classes a test pins on it
 * (appShellScroller.test.ts), the first in document order, which is the shell's: dialogs and sheets are portalled after it. A page can
 * also mark its own scroller with this attribute, which wins.
 */
export const APP_SCROLLER_ATTR = "data-app-scroller";
export const APP_SCROLLER_SELECTOR = "div.h-full.overflow-auto.overscroll-y-contain";

export function getAppScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[${APP_SCROLLER_ATTR}]`) ?? document.querySelector<HTMLElement>(APP_SCROLLER_SELECTOR);
}

export function readScrollTop(): number {
  return getAppScroller()?.scrollTop ?? (typeof window === "undefined" ? 0 : window.scrollY);
}

/**
 * Scroll back to `top`. Content arrives after the route does, so the page may not be tall enough yet: keep trying on each frame until it
 * is, or until `maxMs` has passed. Returns a function that stops the attempt (for an unmount, or a person who scrolled meanwhile).
 */
export function restoreScrollTop(top: number, maxMs = 3000): () => void {
  if (typeof window === "undefined" || !(top > 0)) return () => {};
  const started = Date.now();
  let frame = 0;
  let stopped = false;
  const step = () => {
    if (stopped) return;
    const scroller = getAppScroller();
    const target: { scrollTo: (o: ScrollToOptions) => void; scrollHeight: number; clientHeight: number } | null = scroller
      ?? (document.scrollingElement as HTMLElement | null);
    if (target) {
      target.scrollTo({ top });
      if (target.scrollHeight - target.clientHeight >= top - 1) return;
    }
    if (Date.now() - started < maxMs) frame = window.requestAnimationFrame(step);
  };
  frame = window.requestAnimationFrame(step);
  return () => {
    stopped = true;
    window.cancelAnimationFrame(frame);
  };
}
