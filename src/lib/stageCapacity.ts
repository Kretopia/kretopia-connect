/**
 * How many people a scheduled Stage can seat. go-live-stage opens the video room for `capacity + 10` (the host, speakers and a
 * little headroom), capped at the 200 people Daily allows in one room. A capacity above this would register people who then
 * cannot enter the room, so the form never offers it. A test keeps these numbers in step with go-live-stage.
 */
export const STAGE_ROOM_LIMIT = 200;
export const STAGE_ROOM_HEADROOM = 10;
export const STAGE_MAX_CAPACITY = STAGE_ROOM_LIMIT - STAGE_ROOM_HEADROOM;

/** What the form sends: a whole number from 1 to STAGE_MAX_CAPACITY (50 when empty or not a number, as the server defaults). */
export function clampStageCapacity(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return value === "" || value == null || Number.isNaN(Number(value)) ? 50 : 1;
  return Math.min(n, STAGE_MAX_CAPACITY);
}
