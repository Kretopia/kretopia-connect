export type FlightPose = "fly" | "tuck" | "peek";
export interface FlightStop {
  scroll: number;
  x: number;
  y: number;
  rotate: number;
  turn: number;
  scale: number;
  opacity: number;
  pose: FlightPose;
}

/** Smoothstep interpolation is reversible: scrolling up retraces the same flight. */
export function sampleFlight(stops: FlightStop[], scroll: number): FlightStop | undefined {
  const first = stops[0];
  if (!first) return undefined;
  if (scroll <= first.scroll) return first;
  for (let i = 1; i < stops.length; i++) {
    const end = stops[i];
    const start = stops[i - 1];
    if (scroll > end.scroll) continue;
    const progress = Math.max(0, Math.min(1, (scroll - start.scroll) / Math.max(1, end.scroll - start.scroll)));
    const eased = progress * progress * (3 - 2 * progress);
    const mix = (a: number, b: number) => a + (b - a) * eased;
    return {
      scroll, x: mix(start.x, end.x), y: mix(start.y, end.y),
      rotate: mix(start.rotate, end.rotate), turn: mix(start.turn, end.turn),
      scale: mix(start.scale, end.scale), opacity: mix(start.opacity, end.opacity),
      pose: progress < 0.5 ? start.pose : end.pose,
    };
  }
  return stops[stops.length - 1];
}