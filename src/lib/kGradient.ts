/**
 * Helpers for the non-text parts of the Kretopia gradient. The colours live
 * once, as --k-g-1..4 in src/index.css (:root); everything here derives from
 * them so retuning the gradient is still a single edit.
 */

/** A soft glow/shadow tint taken from the gradient's violet midpoint. Used for
 *  ambient radial glows and box-shadows that used to be flat rgba(255,45,161,α). */
export const kGlow = (percent: number) =>
  `color-mix(in srgb, var(--k-g-2) ${percent}%, transparent)`;

/** Hairline sweep along a card's top edge — the gradient version of
 *  linear-gradient(90deg, transparent, pink, transparent). */
export const K_HAIRLINE =
  "linear-gradient(90deg, transparent, var(--k-g-2), var(--k-g-3), transparent)";
