import { useEffect, useState } from "react";

/**
 * Where the search field sits on the screen.
 *
 * The field is centred in the part of the screen the person can actually see. On a phone that is the visual viewport, which
 * shrinks when the keyboard opens, so the field stays in the middle of what is left above the keyboard instead of being
 * hidden behind it. The results open below the field, and they are given exactly the room that is left, so they never run off
 * the bottom of the screen.
 *
 * When the visible area is too short to give the results a useful list (a phone on its side with the keyboard open), the
 * field moves to the top of the visible area instead: a short list beside a centred field is worse than a field at the top.
 */
export interface SearchStageInput {
  /** Visible height and its offset from the layout viewport's top (the visual viewport). */
  viewportHeight: number;
  viewportTop: number;
  viewportWidth: number;
  /** Top safe-area inset (notch), in px. */
  safeTop: number;
}

export interface SearchStage {
  /** Distance from the top of the layout viewport to the top of the field, in px. */
  top: number;
  /** Height the results list may take below the field, in px. */
  room: number;
  mode: "center" | "top";
}

/** The hero field is h-14 below the sm breakpoint and h-16 from it. */
export const searchFieldHeight = (viewportWidth: number) => (viewportWidth >= 640 ? 64 : 56);
const GAP = 8; // the results sit this far under the field (mt-2)
const MARGIN = 16; // and keep this much clear of the bottom edge
const TOP_PADDING = 16;
/** Below this, a centred field leaves no useful list under it. */
export const MIN_USEFUL_ROOM = 176;

export function computeSearchStage({ viewportHeight, viewportTop, viewportWidth, safeTop }: SearchStageInput): SearchStage {
  const field = searchFieldHeight(viewportWidth);
  const centredRoom = viewportHeight / 2 - field / 2 - GAP - MARGIN;
  if (centredRoom >= MIN_USEFUL_ROOM) {
    return { top: Math.round(viewportTop + viewportHeight / 2 - field / 2), room: Math.floor(centredRoom), mode: "center" };
  }
  const offset = safeTop + TOP_PADDING;
  return {
    top: Math.round(viewportTop + offset),
    room: Math.max(0, Math.floor(viewportHeight - offset - field - GAP - MARGIN)),
    mode: "top",
  };
}

/** The top safe-area inset in px, read once (env() cannot be read from script directly). */
function readSafeTop(): number {
  try {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)";
    document.body.appendChild(probe);
    const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
    return inset;
  } catch {
    return 0;
  }
}

function readViewport(): Omit<SearchStageInput, "safeTop"> {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  return {
    viewportHeight: vv?.height ?? window.innerHeight,
    viewportTop: vv?.offsetTop ?? 0,
    viewportWidth: vv?.width ?? window.innerWidth,
  };
}

/** The stage for the search, kept in step with the visible area while it is open (keyboard, rotation, resize). */
export function useSearchStage(open: boolean): SearchStage {
  const [stage, setStage] = useState<SearchStage>(() => computeSearchStage({ ...readViewport(), safeTop: 0 }));

  useEffect(() => {
    if (!open) return;
    const safeTop = readSafeTop();
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setStage(computeSearchStage({ ...readViewport(), safeTop })));
    };
    setStage(computeSearchStage({ ...readViewport(), safeTop }));
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return stage;
}
