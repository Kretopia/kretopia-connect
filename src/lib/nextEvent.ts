/**
 * Today's "next event": the pure part. Which event is next for this person,
 * and how to say when it is. The data is creative_jams rows the person hosts
 * or has RSVP'd 'going' to; nothing is inferred or filled in.
 */

export interface EventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  venue_name: string | null;
  category: string | null;
  cover_image_url: string | null;
  event_mode: string | null;
  status: string | null;
}

export type EventRole = "hosting" | "going";

export interface NextEvent extends EventRow {
  role: EventRole;
}

/** A cancelled or ended event is not "next", whatever its start time says. */
const DEAD_STATUSES = new Set(["cancelled", "canceled", "ended", "completed", "archived"]);

export const isLive = (e: Pick<EventRow, "status">): boolean => !DEAD_STATUSES.has((e.status ?? "").toLowerCase());

/**
 * The earliest upcoming event across what the person hosts and what they are
 * going to. When they host an event they also RSVP'd to, hosting wins (it is
 * the stronger relationship and the one with duties attached).
 */
export function pickNextEvent(hosted: EventRow[], going: EventRow[], now: Date = new Date()): NextEvent | null {
  const upcoming = (rows: EventRow[], role: EventRole): NextEvent[] =>
    rows
      .filter((e) => isLive(e) && Date.parse(e.start_time) >= now.getTime())
      .map((e) => ({ ...e, role }));
  const hostedIds = new Set(hosted.map((e) => e.id));
  const all = [...upcoming(hosted, "hosting"), ...upcoming(going.filter((e) => !hostedIds.has(e.id)), "going")];
  all.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  return all[0] ?? null;
}

/** YYYY-MM-DD in the viewer's (or the given) time zone. */
const dayKey = (d: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** "Today · 7:30 PM", "Tomorrow · 7:30 PM", "Sat, Oct 12 · 7:30 PM". The viewer's own time zone unless one is given. */
export function formatEventWhen(startIso: string, now: Date = new Date(), locale?: string, timeZone?: string): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "";
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(start);
  const day = dayKey(start, timeZone);
  if (day === dayKey(now, timeZone)) return `Today · ${time}`;
  if (day === dayKey(new Date(now.getTime() + 86_400_000), timeZone)) return `Tomorrow · ${time}`;
  const date = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", month: "short", day: "numeric" }).format(start);
  return `${date} · ${time}`;
}
