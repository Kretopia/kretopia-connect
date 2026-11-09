/**
 * The one set of numbers the top bar's action icons (search, messages, notifications, menu, theme) are drawn with.
 *
 * They come from two sources that were never set up together: the Kretopia glyph set (a 1.75 stroke, glyphs that fill about two thirds of
 * their 24-unit box) and lucide (a stroke of 2, glyphs that fill three quarters of it or more). Next to each other that read as different
 * sizes and weights. Measured in a browser every one of them already renders 16 px wide and high (Button sizes the svg inside it to 1rem,
 * which wins over the 18/20 px classes some of them carried), so the size is kept as it was and what is made equal is what the eye
 * compares: the stroke, the part of the box the glyph fills, and the box each one sits in.
 *
 * The colour is not here: every icon inherits the bar's one text token (--k-nav-text, see .k-top-bar).
 */

/** The same size for every icon. Written out so it no longer depends on Button's own svg rule. */
export const NAV_ICON = "h-4 w-4";

/** The same stroke for every icon: the Kretopia glyph set's. */
export const NAV_ICON_STROKE = 1.75;

/** The same box for every icon button: 32 px on a phone, 40 px from sm, both above the 24 px minimum for a touch target. */
export const NAV_ICON_BUTTON = "relative h-8 w-8 sm:h-10 sm:w-10";

/** One drawn unit of a 24-unit icon box, in the stroke the bar uses: a glyph in a cropped box needs its stroke scaled with the crop. */
const strokeForBox = (boxUnits: number) => Number(((NAV_ICON_STROKE * boxUnits) / 24).toFixed(3));

/**
 * Crops the Kretopia search glyph to the fill of the lucide icons beside it. Its ink is 15.75 of 24 units, the message icon's 19: a box of
 * 19.9 units (centred on the glyph's ink centre, 12.125) draws it 15.75 / 19.9 of the way across, as 19 / 24 is there. The stroke is
 * scaled with the box so the line is not heavier than its neighbours'.
 */
export const SEARCH_ICON = { viewBox: "2.18 2.18 19.9 19.9", strokeWidth: strokeForBox(19.9) } as const;

/**
 * The same for the sun: its rays fill 20 of 24 units, so a box of 25.26 units (centred on the glyph, at 12) draws them as far across as the
 * message icon's 19 / 24. The moon beside it in the other state fills 18 and is left as drawn.
 */
export const SUN_ICON = { viewBox: "-0.63 -0.63 25.26 25.26", strokeWidth: strokeForBox(25.26) } as const;
