/**
 * The foil's strength, in one place. The sheen lies over the card's own content, so it has to stay light enough that a name, a role and
 * the key figures read at every pointer position, in light and in dark mode: it used to wash them out (a 0.55 white core at 0.6 opacity
 * under the pointer). It is softened, not removed: the card still catches the light, before and while it is touched.
 */
export const HOLO_FOIL = { idleOpacity: 0.28, activeOpacity: 0.4, coreAlpha: 0.28, falloffAlpha: 0.04 } as const;

/** The sheen's gradient, centred under the pointer (percent of the card). */
export const foilGradient = (x: number, y: number) =>
  `radial-gradient(120% 90% at ${x}% ${y}%, hsl(var(--foreground)/${HOLO_FOIL.coreAlpha}), hsl(var(--foreground)/${HOLO_FOIL.falloffAlpha}) 35%, transparent 65%)`;
