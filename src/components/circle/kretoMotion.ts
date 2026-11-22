/** Frame-rate independent viewer motion, without React updates or rendering dependencies. */
export const KRETO_TURN_RESPONSE = 14;
export const KRETO_TURN_DRAG = 6;
export const KRETO_DRAG_SENSITIVITY = 0.009;
export function dampKretoAngle(current: number, target: number, seconds: number): number {
  return target + (current - target) * Math.exp(-KRETO_TURN_RESPONSE * Math.max(0, seconds));
}
export function glideKretoTurn(velocity: number, seconds: number): { distance: number; velocity: number } {
  const decay = Math.exp(-KRETO_TURN_DRAG * Math.max(0, seconds));
  return { distance: velocity * (1 - decay) / KRETO_TURN_DRAG, velocity: velocity * decay };
}