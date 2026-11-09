export interface EventCountdown {
  days: number;
  hours: number;
  minutes: number;
  ended: boolean;
}

export function getEventCountdown(
  startTime: string | null | undefined,
  now: number | Date = Date.now(),
): EventCountdown | null {
  if (!startTime) return null;

  const start = Date.parse(startTime);
  const current = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(current)) return null;

  const remainingMinutes = Math.max(0, Math.floor((start - current) / 60_000));
  return {
    days: Math.floor(remainingMinutes / (60 * 24)),
    hours: Math.floor((remainingMinutes % (60 * 24)) / 60),
    minutes: remainingMinutes % 60,
    ended: start <= current,
  };
}
