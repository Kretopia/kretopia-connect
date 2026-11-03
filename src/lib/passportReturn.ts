import { readScrollTop } from "@/lib/appScroller";
import { isInAppPath } from "@/lib/inAppPath";

/**
 * Where a detail view (a credit, a production) was opened from, so it can offer a real way back: the Passport's own address, including
 * its query string, and how far down the page the person was. It travels in the router's location state, and the back link goes to
 * `path` explicitly: it does not rely on the browser's history being what we expect.
 */
export interface ReturnTo {
  path: string;
  label: string;
  scrollTop: number;
}

export function returnState(path: string, label = "Passport", scrollTop = readScrollTop()) {
  return { returnTo: { path, label, scrollTop } satisfies ReturnTo };
}

/** Reads the return target out of a location state, or null. Only an in-app path is accepted, whatever the state says. */
export function readReturnTo(state: unknown): ReturnTo | null {
  const value = (state as { returnTo?: unknown } | null)?.returnTo as Partial<ReturnTo> | undefined;
  if (!value || !isInAppPath(value.path)) return null;
  const label = typeof value.label === "string" && value.label.trim() ? value.label.trim().slice(0, 60) : "Passport";
  const scrollTop = typeof value.scrollTop === "number" && Number.isFinite(value.scrollTop) && value.scrollTop > 0 ? Math.round(value.scrollTop) : 0;
  return { path: value.path, label, scrollTop };
}

/** The state the back link hands to the page it returns to: where to scroll. */
export const restoreState = (scrollTop: number) => ({ restoreScrollTop: scrollTop });

export function readRestoreScrollTop(state: unknown): number {
  const top = (state as { restoreScrollTop?: unknown } | null)?.restoreScrollTop;
  return typeof top === "number" && Number.isFinite(top) && top > 0 ? top : 0;
}
