// Universal "Add to Calendar" helpers — no OAuth, works for every user.
// Google → render-URL deep link. Apple/Outlook/anything → downloadable .ics blob.

export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string; // typically the meeting URL
  startISO: string; // ISO datetime
  durationMinutes?: number; // default 60
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Format a JS Date to the basic UTC format Google + ICS both accept: YYYYMMDDTHHMMSSZ */
function toBasicUTC(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function endISO(startISO: string, mins: number): string {
  return new Date(new Date(startISO).getTime() + mins * 60_000).toISOString();
}

/** Build a Google Calendar pre-filled event URL. Opens in browser; user just hits Save. */
export function buildGoogleCalendarUrl(e: CalendarEventInput): string {
  const mins = e.durationMinutes ?? 60;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toBasicUTC(e.startISO)}/${toBasicUTC(endISO(e.startISO, mins))}`,
  });
  if (e.description) params.set("details", e.description);
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escape per RFC 5545. */
function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Build a minimal valid .ics file body. Works with Apple Calendar, Outlook, etc. */
export function buildIcsString(e: CalendarEventInput): string {
  const mins = e.durationMinutes ?? 60;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@kretopia.com`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kretopia//Meeting//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toBasicUTC(new Date().toISOString())}`,
    `DTSTART:${toBasicUTC(e.startISO)}`,
    `DTEND:${toBasicUTC(endISO(e.startISO, mins))}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.description ? `DESCRIPTION:${icsEscape(e.description)}` : null,
    e.location ? `LOCATION:${icsEscape(e.location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/** Trigger a .ics file download in the browser (Apple/Outlook/anything). */
export function downloadIcs(e: CalendarEventInput, filename = "meeting.ics") {
  const blob = new Blob([buildIcsString(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
