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
export const SIDE_UPPER_BODY_CLIP = 'inset(0 0 31% 0)';

/** Longer eased emergence, leaving a genuine resting interval on each ledge. */
export const ledgeSlideSpan = (topAt: number, middle: number, release: number) =>
  Math.min(180, (middle - topAt) / 3, (release - middle) / 3);
/** Narrower than this a chapter has no outer margin to peek into: he flips past the media instead. */
export const SIDE_MIN_VIEWPORT = 768;
/** Less visible than this (about a laptop screen's margin) and the peek stops reading as a character, so it is not drawn. */
export const SIDE_MIN_ROOM = 40;
/** Gap kept between what shows and the edge of the screen. */
const SIDE_SCREEN_GAP = 8;

export interface SideHideInput {
  vw: number;
  /** The media's left and right edges in the same coordinates as `vw`. */
  mediaLeft: number;
  mediaRight: number;
  /** The chapter's text column, only when it sits beside the media. */
  text?: { left: number; right: number } | null;
  /** Flying's box size at this width. */
  size: number;
  /** Opaque width of the side artwork beyond the media edge, as a fraction of the box (`SIDE.extent`). */
  extent: number;
}

export interface SideHide {
  side: "left" | "right";
  /** Margin available on that side, to the screen edge. */
  room: number;
  /** How far past the media edge he comes out at most: the full artwork where it fits, otherwise what the margin allows. */
  reveal: number;
  /** The artwork's full reach beyond the edge at Flying's apparent size. */
  full: number;
}

/**
 * Where he plays hide and seek at the side of a media. He keeps Flying's apparent size (the artwork is
 * never shrunk to fit): in a narrow margin he simply comes out less, the rest of him staying behind the
 * media. The side is the one away from the chapter's text, else the one with more room.
 */
export function planSideHide({ vw, mediaLeft, mediaRight, text, size, extent }: SideHideInput): SideHide | null {
  if (vw < SIDE_MIN_VIEWPORT) return null;
  const roomLeft = mediaLeft - SIDE_SCREEN_GAP;
  const roomRight = vw - mediaRight - SIDE_SCREEN_GAP;
  const side: "left" | "right" = text ? (text.left >= mediaRight ? "left" : "right") : roomRight >= roomLeft ? "right" : "left";
  const room = side === "right" ? roomRight : roomLeft;
  if (room < SIDE_MIN_ROOM) return null;
  const full = extent * size * SIDE_SCALE;
  return { side, room, reveal: Math.min(full, room), full };
}
