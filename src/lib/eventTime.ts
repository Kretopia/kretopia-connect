import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function validEventTimeZone(value?: string | null): string {
  if (value) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return value;
    } catch { /* Legacy records with no usable zone are shown explicitly in UTC. */ }
  }
  return "UTC";
}

export function eventTimeZone() {
  return validEventTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function eventTimeZoneLabel(zone: string, instant: Date = new Date()) {
  const timeZone = validEventTimeZone(zone);
  const offset = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(instant).find(part => part.type === "timeZoneName")?.value || "GMT";
  return `${timeZone} (${offset})`;
}

/** Wall-clock input is interpreted in the chosen IANA zone, never the browser zone. */
export function eventLocalToUtc(local: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || validEventTimeZone(zone) !== zone) {
    throw new Error("Choose a valid date, time and time zone.");
  }
  const utc = fromZonedTime(`${local}:00`, zone);
  if (!Number.isFinite(utc.getTime()) || formatInTimeZone(utc, zone, "yyyy-MM-dd'T'HH:mm") !== local) {
    throw new Error("This local time does not exist in the selected time zone. Choose another time.");
  }
  // Reject ambiguous fall-back times rather than silently choosing the wrong UTC instant.
  for (const minutes of [-120, -60, -30, 30, 60, 120]) {
    if (formatInTimeZone(new Date(utc.getTime() + minutes * 60_000), zone, "yyyy-MM-dd'T'HH:mm") === local) {
      throw new Error("This local time occurs twice in the selected time zone. Choose an unambiguous time.");
    }
  }
  return utc.toISOString();
}

export function eventUtcToLocal(value: string, zone: string): string {
  return formatInTimeZone(value, validEventTimeZone(zone), "yyyy-MM-dd'T'HH:mm");
}

export function eventSchedule(localStart: string, localEnd: string, timezone: string) {
  const start_time = eventLocalToUtc(localStart, timezone);
  const end_time = localEnd ? eventLocalToUtc(localEnd, timezone) : null;
  if (end_time && Date.parse(end_time) <= Date.parse(start_time)) {
    throw new Error("End must be after start in the selected time zone.");
  }
  return { start_time, end_time, timezone };
}

export function getEventTiming(event: { start_time: string; end_time?: string | null; status?: string | null }, now = Date.now()) {
  const start = Date.parse(event.start_time);
  const end = event.end_time ? Date.parse(event.end_time) : null;
  const valid = Number.isFinite(start) && (end === null || (Number.isFinite(end) && end > start));
  const ended = valid && (event.status === "completed" || (end !== null && now >= end));
  return { valid, ended, active: valid && !ended && event.status !== "cancelled" && now >= start, upcoming: valid && !ended && now < start };
}

export function formatEventTime(value: string, zone?: string | null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: validEventTimeZone(zone),
    timeZoneName: "shortOffset",
  }).format(date);
}
