/** Measured helmet widths in the original 1024px artwork; preserve apparent character size. */
export const FLYING_HELMET_WIDTH = 693;
export const BOTTOM_HELMET_WIDTH = 365;
export const BOTTOM_SCALE = FLYING_HELMET_WIDTH / BOTTOM_HELMET_WIDTH;
/** The hands' contact line in original artwork coordinates. */
export const BOTTOM_LEDGE = (350 / 1024) * BOTTOM_SCALE;
export const BOTTOM_HEIGHT = BOTTOM_SCALE;
/** Side artwork helmet is 515px wide; match apparent Flying scale without stretching. */
export const SIDE_HELMET_WIDTH = 515;
export const SIDE_SCALE = FLYING_HELMET_WIDTH / SIDE_HELMET_WIDTH;
/** Crop above the hips; leaves the original dome, chest and gloves intact. */
export const SIDE_UPPER_BODY_CLIP = 'inset(0 0 34% 0)';

/** Fit the emergence, never the character: a narrow gutter reveals less of the same-sized bust. */
export function sideEmergence(room: number, box: number) {
  const extent = 0.48 * box * SIDE_SCALE;
  const reveal = Math.min(extent, Math.max(0, room - 10));
  return { extent, reveal, enabled: reveal >= box * 0.12 };
}

/** Longer eased emergence, leaving a genuine resting interval on each ledge. */
export const ledgeSlideSpan = (topAt: number, middle: number, release: number) =>
  Math.min(180, (middle - topAt) / 3, (release - middle) / 3);