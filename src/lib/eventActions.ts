// Utilities for IRL event guest actions: Add to Calendar (.ics), Get Directions
// deep-links, and Warm-&-Human share copy with promoter/host attribution tracking.

import { supabase } from "@/integrations/supabase/client";
import { APP_URL } from "@/lib/constants";

export type ShareChannel = "native" | "whatsapp" | "twitter" | "copy" | "qr" | "embed" | "unknown";

interface WarmShareEventInput {
  id: string;
  title: string;
  startTime: string;
  venueName?: string | null;
  ticketPrice?: number | null;
  ticketCurrency?: string | null;
  isTicketed?: boolean | null;
  attendeeCount?: number | null;
}

interface WarmShareOptions {
  hostFirstName?: string | null;
  sharerFirstName?: string | null;
  sharerUsername?: string | null;
  isHost?: boolean;
}

/** Build a Warm & Human share message: personal one-liner + clean info block + ref'd short link. */
export const buildWarmShareMessage = (
  event: WarmShareEventInput,
  options: WarmShareOptions = {}
): { text: string; url: string } => {
  const url = buildEventShareUrl(event.id, options.sharerUsername);

  const date = new Date(event.startTime);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Personal one-liner
  let opener: string;
  if (options.isHost) {
    opener = `Hey — I'm hosting "${event.title}" ${dateStr}. Would love to see you there 🤝`;
  } else if (options.sharerFirstName) {
    const host = options.hostFirstName ? ` (hosted by ${options.hostFirstName})` : "";
    opener = `Found something good: "${event.title}"${host}. Thinking of going — come with?`;
  } else {
    const host = options.hostFirstName ? ` Hosted by ${options.hostFirstName}.` : "";
    opener = `Check this out: "${event.title}".${host}`;
  }

  // Clean info block
  const lines: string[] = [];
  lines.push(`📅 ${dateStr} · ${timeStr}`);
  if (event.venueName) lines.push(`📍 ${event.venueName}`);
  if (event.isTicketed && event.ticketPrice) {
    const sym = event.ticketCurrency === "EUR" ? "€" : event.ticketCurrency === "GBP" ? "£" : event.ticketCurrency === "TTD" ? "TT$" : "$";
    lines.push(`🎟️ ${sym}${event.ticketPrice}`);
  } else {
    lines.push(`🎟️ Free`);
  }
  if (event.attendeeCount && event.attendeeCount > 0) {
    lines.push(`👥 ${event.attendeeCount} going`);
  }

  const text = `${opener}\n\n${lines.join("\n")}\n\n${url}`;
  return { text, url };
};

/** Returns the canonical shareable event URL with optional ?ref=username for attribution. */
export const buildEventShareUrl = (eventId: string, sharerUsername?: string | null): string => {
  const base = `${APP_URL}/share/event/${eventId}/`;
  if (!sharerUsername) return base;
  return `${base}?ref=${encodeURIComponent(sharerUsername)}`;
};

/** Log a share click for attribution. Fire-and-forget, never throws. */
export const logShareClick = async (
  eventId: string,
  channel: ShareChannel,
  referrerUserId?: string | null
): Promise<void> => {
  try {
    await supabase.from("event_share_clicks").insert({
      event_id: eventId,
      referrer_user_id: referrerUserId || null,
      channel,
      visitor_session: typeof window !== "undefined" ? sessionStorage.getItem("session_id") : null,
    });
  } catch {
    // silent — never block the share UX
  }
};

/** Read ?ref= from current URL and resolve to a user_id (cached in sessionStorage for the visit). */
export const captureRefFromUrl = async (eventId: string): Promise<string | null> => {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return null;

    const cacheKey = `event_ref_${eventId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;

    const { data } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", ref)
      .maybeSingle();

    if (data?.user_id) {
      sessionStorage.setItem(cacheKey, data.user_id);
      return data.user_id;
    }
  } catch {
    // silent
  }
  return null;
};

interface IcsEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO
  endTime?: string | null; // ISO
  venueName?: string | null;
  venueAddress?: string | null;
  url?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

const toIcsDate = (iso: string) => {
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
};

const escapeIcs = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/**
 * Build an .ics file string and trigger a download.
 * Works on iOS (opens Calendar), Android (opens Calendar), Outlook, Google Calendar import.
 */
export const downloadIcs = (event: IcsEvent) => {
  const dtStart = toIcsDate(event.startTime);
  // Default to +2h if no end time given
  const endIso =
    event.endTime ||
    new Date(new Date(event.startTime).getTime() + 2 * 60 * 60 * 1000).toISOString();
  const dtEnd = toIcsDate(endIso);
  const dtStamp = toIcsDate(new Date().toISOString());

  const location = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
  const descParts: string[] = [];
  if (event.description) descParts.push(event.description);
  if (event.url) descParts.push(`\n\nDetails: ${event.url}`);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kretopia//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@kretopia.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    descParts.length ? `DESCRIPTION:${escapeIcs(descParts.join(""))}` : "",
    location ? `LOCATION:${escapeIcs(location)}` : "",
    event.url ? `URL:${event.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Open native maps app with directions to the venue.
 * iOS → Apple Maps, everywhere else → Google Maps. Both support web fallback.
 */
export const openDirections = (venueAddress?: string | null, venueName?: string | null) => {
  const query = encodeURIComponent(venueAddress || venueName || "");
  if (!query) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const url = isIOS
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;

  window.open(url, "_blank", "noopener,noreferrer");
};
