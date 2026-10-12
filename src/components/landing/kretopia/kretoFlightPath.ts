export type FlightPose = "fly" | "peekTop" | "peekBottom" | "stand";
export interface FlightStop {
  scroll: number;
  x: number;
  y: number;
  /** Absolute in-plane rotation; loops are cumulative multiples of 360. */
  rotate: number;
  opacity: number;
  pose: FlightPose;
  facing?: -1 | 1;
}

export interface LedgeLock {
  from: number;
  to: number;
  x: number;
  y: number;
  pose: "peekTop" | "peekBottom";
}

/** Boundary-based hysteresis: tiny reversals cannot replay a dock/undock. */
export function ledgeLockAt(locks: LedgeLock[], scroll: number, active?: LedgeLock): LedgeLock | undefined {
  if (active && scroll >= active.from - 18 && scroll <= active.to + 18) return active;
  return locks.find(lock => scroll >= lock.from && scroll <= lock.to);
}

const same = (a?: FlightStop, b?: FlightStop) => !!a && !!b && a.x === b.x && a.y === b.y;

/** Finite-difference tangent scaled to the segment; zero at holds so Kreto settles instead of overshooting. */
function tangent(stops: FlightStop[], i: number, key: "x" | "y", span: number) {
  const prev = stops[i - 1];
  const next = stops[i + 1];
  if (!prev || !next || same(prev, stops[i]) || same(stops[i], next)) return 0;
  if (key === "x") {
    const current = stops[i];
    const incoming = (current.x - prev.x) / Math.max(1, current.scroll - prev.scroll);
    const outgoing = (next.x - current.x) / Math.max(1, next.scroll - current.scroll);
    if (incoming * outgoing <= 0) return 0;
    const slope = (incoming + outgoing) / 2;
    return Math.sign(slope) * Math.min(Math.abs(slope), 3 * Math.min(Math.abs(incoming), Math.abs(outgoing))) * span;
  }
  return ((next[key] - prev[key]) / Math.max(1, next.scroll - prev.scroll)) * span;
}

/**
 * Continuous-velocity (cubic Hermite) path through every stop. Pure function of
 * scroll, so scrolling back up retraces exactly the same flight.
 */
export function sampleFlight(stops: FlightStop[], scroll: number): FlightStop | undefined {
  const first = stops[0];
  if (!first) return undefined;
  if (scroll <= first.scroll) return first;
  for (let i = 1; i < stops.length; i++) {
    const end = stops[i];
    const start = stops[i - 1];
    if (scroll > end.scroll) continue;
    const span = Math.max(1, end.scroll - start.scroll);
    const t = Math.max(0, Math.min(1, (scroll - start.scroll) / span));
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const curve = (key: "x" | "y") =>
      h00 * start[key] + h10 * tangent(stops, i - 1, key, span) + h01 * end[key] + h11 * tangent(stops, i, key, span);
    const eased = t * t * (3 - 2 * t);
    // Dock before changing artwork; keep the ledge pose through the first
    // half of departure so the flying replacement happens behind the media.
    const switchAt = end.pose !== "fly" ? 0.95 : start.pose !== "fly" ? 0.55 : 0.5;
    return {
      scroll, x: curve("x"), y: curve("y"),
      rotate: start.rotate + (end.rotate - start.rotate) * eased,
      opacity: start.opacity + (end.opacity - start.opacity) * t,
      pose: t < switchAt ? start.pose : end.pose,
      ...(start.facing !== undefined || end.facing !== undefined ? { facing: t < 0.5 ? start.facing ?? end.facing : end.facing ?? start.facing } : {}),
    };
  }
  return stops[stops.length - 1];
}

/** Scroll-keyed turnaround: brake at a waypoint, backflip, then depart.
 * A constant-width image preserves the rendered volume instead of going edge-on.
 */
export function withFlightTurns(stops: FlightStop[], edges?: { left: number; right: number }): FlightStop[] {
  const result: FlightStop[] = [];
  let spin = 0;
  let facing: -1 | 1 = 1;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const prev = stops.slice(0, i).reverse().find(p => Math.abs(p.x - stop.x) > 4);
    const next = stops.slice(i + 1).find(p => Math.abs(p.x - stop.x) > 4);
    const incoming = prev ? Math.sign(stop.x - prev.x) : next ? Math.sign(next.x - stop.x) : facing;
    const outgoing = next ? Math.sign(next.x - stop.x) : incoming;
    facing = incoming < 0 ? -1 : 1;
    const before = stops[i - 1];
    const after = stops[i + 1];
    const atEdge = !edges || Math.abs(stop.x - edges.left) < 2 || Math.abs(stop.x - edges.right) < 2;
    if (atEdge && stop.pose === "fly" && before && after && incoming !== outgoing) {
      const span = Math.min(55, (stop.scroll - before.scroll) * 0.3, (after.scroll - stop.scroll) * 0.3);
      result.push({ ...stop, scroll: stop.scroll - span, rotate: stop.rotate + spin, facing });
      const nextFacing = outgoing < 0 ? -1 : 1;
      result.push({ ...stop, rotate: stop.rotate + spin - facing * 180, facing: nextFacing });
      spin -= facing * 360;
      result.push({ ...stop, scroll: stop.scroll + span, rotate: stop.rotate + spin, facing: nextFacing });
      facing = nextFacing;
    } else result.push({ ...stop, rotate: stop.rotate + spin, facing });
  }
  return result;
}

/** Deterministic bottom flourish: retraced in reverse on ascent, no event replays. */
export function bottomBackflip(scroll: number, end: number): number {
  const t = Math.max(0, Math.min(1, (scroll - (end - 280)) / 280));
  return 720 * t * t * (3 - 2 * t);
}

/** -1 flying left, 1 flying right, 0 hovering (keep the current heading). */
export function headingAt(stops: FlightStop[], scroll: number, window = 30, threshold = 4): -1 | 0 | 1 {
  const a = sampleFlight(stops, scroll - window);
  const b = sampleFlight(stops, scroll + window);
  if (!a || !b) return 0;
  const dx = b.x - a.x;
  return Math.abs(dx) < threshold ? 0 : dx > 0 ? 1 : -1;
}

/** Reverse the nose on ascent, including the stationary midpoint of a turn. */
export function travelHeading(stops: FlightStop[], scroll: number, direction: -1 | 1): -1 | 0 | 1 {
  const heading = headingAt(stops, scroll, 12, 0.5) || sampleFlight(stops, scroll)?.facing || 0;
  return (heading * direction) as -1 | 0 | 1;
}
