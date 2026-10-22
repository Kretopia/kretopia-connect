/** Measured helmet widths in the original 1024px artwork; preserve apparent character size. */
export const FLYING_HELMET_WIDTH = 693;
export const BOTTOM_HELMET_WIDTH = 365;
export const BOTTOM_SCALE = FLYING_HELMET_WIDTH / BOTTOM_HELMET_WIDTH;
/** The hands' contact line in original artwork coordinates. */
export const BOTTOM_LEDGE = (350 / 1024) * BOTTOM_SCALE;
export const BOTTOM_HEIGHT = BOTTOM_SCALE;

/** Longer eased emergence, leaving a genuine resting interval on each ledge. */
export const ledgeSlideSpan = (topAt: number, middle: number, release: number) =>
  Math.min(180, (middle - topAt) / 3, (release - middle) / 3);