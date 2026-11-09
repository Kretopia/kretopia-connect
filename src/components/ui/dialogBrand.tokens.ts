/**
 * The Kretopia modal, as the Passport QR modal draws it: the one place its values live. The QR modal, the dialog and alert-dialog
 * primitives (for a signed-in member) and any modal that wants the full branded header all read these, so they cannot drift apart.
 * No JSX and no imports, so the primitives can read it without a cycle.
 *
 * The backdrop (black at 80%), the opening animation (fade and zoom) and the close control are the primitives' own, which the QR modal
 * also uses unchanged; only what the QR modal added on top of them is here.
 */

/** Surface, border and aura: the card colour, a hairline of the energy colour and the glow shadow around it. */
export const DIALOG_SURFACE = "border-energy/30 bg-card shadow-glow";

/** The backdrop behind a modal: black at 80%. The dialog, alert dialog and sheet primitives draw it, and so does any overlay that is not one of them. */
export const DIALOG_BACKDROP = "bg-black/80";

/**
 * The close control's look, as the dialog primitive draws it: faint until it is hovered, with a ring on focus. Its place is the header's, so a
 * modal that is not a Radix dialog and lays its own header out puts this on its close button and keeps its own position and hit area.
 */
export const DIALOG_CLOSE =
  "rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none";

/**
 * A modal that is taller than the screen scrolls inside itself. `dvh`, not `vh`: on a phone the address bar makes 100vh taller than what
 * is visible, which pushed a tall modal's last row (and its buttons) off the screen.
 */
export const DIALOG_SCROLL = "max-h-[calc(100dvh-2rem)] overflow-y-auto";

/**
 * The title, at the QR modal's size, weight and tracking. `text-2xl` brings its own line height and makes tailwind-merge drop the
 * primitive's `leading-none`, exactly as it already does in the QR modal, so a title that wraps keeps readable lines. The tracking is
 * spelled out because the alert dialog's title has none of its own and would otherwise fall back to the page's heading tracking.
 */
export const DIALOG_TITLE = "text-2xl font-semibold tracking-tight";

/** The header band of the full branded header (see DialogBrandHeader), and the body under it. */
export const DIALOG_EYEBROW = "text-xs font-bold uppercase text-energy";
export const DIALOG_HEADER =
  "relative border-b border-energy/20 bg-gradient-to-br from-card via-card to-energy/10 px-5 pb-5 pt-6 sm:px-6";
export const DIALOG_BODY = "px-5 py-5 sm:px-6";
