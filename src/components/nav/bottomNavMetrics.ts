/**
 * The geometry the mobile bottom bar and its center "+" (QuickActionFab) must agree on.
 *
 * The "+" is a separate fixed layer that floats over the middle of the bar. The bar therefore reserves a slot there, sized from the
 * button, so an entry or a label is never underneath it. Both read these numbers; changing the button's size changes the slot.
 */
export const FAB_SIZE_PX = 56;
/** Clear space between the button and the nearest entry, on each side. */
export const FAB_CLEARANCE_PX = 18;
export const FAB_SLOT_PX = FAB_SIZE_PX + 2 * FAB_CLEARANCE_PX;

/** Kretopia's brand gradient (the --k-g-* tokens), for the active mark, the edge line and the "+" ring. */
export const BRAND_GRADIENT = "linear-gradient(105deg, var(--k-g-1, #4012F8), var(--k-g-2, #A516C5), var(--k-g-3, #F62489), var(--k-g-4, #FFA722))";

/** The hairline on the bar's top edge: the same four colours, fading out at both ends. */
export const BRAND_EDGE = "linear-gradient(90deg, transparent, var(--k-g-1, #4012F8), var(--k-g-2, #A516C5), var(--k-g-3, #F62489), var(--k-g-4, #FFA722), transparent)";

/** Where the "+" sits: on the row of entries, lifted a little so it reads as floating over the bar. */
export const FAB_BOTTOM = "calc(max(env(safe-area-inset-bottom, 0px), 10px) + 5px)";
