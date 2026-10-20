// Keeps one tab from flooding analytics_events when something calls trackEvent in a loop. Between April and
// August 2026, 90 sessions wrote 1.2 million rows (87% of the table) that way, most of them a "page_view" and a
// "feature_used" fired again and again by the same Studio effect.
//
// Two rules, per tab:
//  1. The same event on the same page with the same properties is dropped while it keeps repeating within
//     `duplicateWindowMs`. The clock restarts on every attempt, so a loop that fires every few milliseconds is
//     reduced to its first event, not to one event per window.
//  2. At most `maxPerWindow` events per `windowMs`. Real use stays far below this: over 45 days of production
//     data, 99.9% of session-minutes had 34 events or fewer, and 1 in 11,728 reached 60.

export interface ThrottleConfig {
  duplicateWindowMs: number;
  windowMs: number;
  maxPerWindow: number;
}

export const ANALYTICS_THROTTLE: ThrottleConfig = {
  duplicateWindowMs: 5_000,
  windowMs: 60_000,
  maxPerWindow: 60,
};

export type ThrottleDecision = "allow" | "duplicate" | "cap";

const MAX_TRACKED_KEYS = 200;

/** JSON with sorted keys, so { a, b } and { b, a } are the same event. Never throws. */
function stableKey(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
        : v,
    ) ?? "";
  } catch {
    return String(value);
  }
}

export function createAnalyticsThrottle(config: ThrottleConfig = ANALYTICS_THROTTLE, now: () => number = Date.now) {
  const lastSeen = new Map<string, number>();
  let windowStart = 0;
  let allowedInWindow = 0;

  return {
    check(eventName: string, pagePath: string, properties: unknown): ThrottleDecision {
      const t = now();
      const key = `${eventName}|${pagePath}|${stableKey(properties).slice(0, 500)}`;

      const previous = lastSeen.get(key);
      lastSeen.set(key, t);
      if (lastSeen.size > MAX_TRACKED_KEYS) {
        for (const [k, seen] of lastSeen) if (t - seen >= config.duplicateWindowMs) lastSeen.delete(k);
      }
      if (previous !== undefined && t - previous < config.duplicateWindowMs) return "duplicate";

      if (t - windowStart >= config.windowMs) {
        windowStart = t;
        allowedInWindow = 0;
      }
      if (allowedInWindow >= config.maxPerWindow) return "cap";
      allowedInWindow += 1;
      return "allow";
    },
  };
}
