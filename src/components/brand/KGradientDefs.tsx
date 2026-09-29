/**
 * The SVG paint server behind `.k-gradient-icon` (see index.css): lucide
 * icons stroke with currentColor, and CSS gradients can't paint a stroke, so
 * icons reference this <linearGradient> instead.
 *
 * Mount ONCE per document. It's width/height 0 rather than display:none on
 * purpose -- Chrome and Safari refuse to resolve gradients that live inside
 * a display:none <svg>.
 *
 * userSpaceOnUse with a 24x24 box matches lucide's viewBox, so every icon
 * (including ones whose path is a single straight line, which has a zero-size
 * bounding box and would render nothing under objectBoundingBox) gets the
 * whole gradient. Stops read the same --k-g-* variables as the text gradient
 * so there is still one place to retune the colours.
 */
export const KGradientDefs = () => (
  <svg
    aria-hidden
    focusable="false"
    width="0"
    height="0"
    style={{ position: "absolute", pointerEvents: "none" }}
  >
    <defs>
      <linearGradient id="k-icon-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0%" style={{ stopColor: "var(--k-g-1)" }} />
        <stop offset="35%" style={{ stopColor: "var(--k-g-2)" }} />
        <stop offset="65%" style={{ stopColor: "var(--k-g-3)" }} />
        <stop offset="100%" style={{ stopColor: "var(--k-g-4)" }} />
      </linearGradient>
    </defs>
  </svg>
);

export default KGradientDefs;
