// Who may ask send-transactional-email to send what, to whom.
//
// Before this module the function trusted every caller that held *any* valid
// JWT, and the public anon key is one: anyone could send any template to any
// address with any text and links, from our domain. Now:
//
//   service role (other edge functions, cron)  -> unchanged, anything goes
//   everyone else                              -> only the four templates the
//                                                 app really sends from the
//                                                 browser, each with proof of
//                                                 the relationship that makes
//                                                 the email legitimate, the
//                                                 recipient pinned to that
//                                                 relationship, links limited
//                                                 to our own domains, event
//                                                 text re-read from the
//                                                 database, and a send cap.
//
// Pure decision logic: every database read comes in through `deps` so it can be
// unit-tested without a database.

import type { Caller } from "./callerAuth.ts";

export const CLIENT_TEMPLATES = [
  "event-registration-confirmation",
  "application-confirmation",
  "new-applicant-notification",
  "application-status-update",
] as const;

export const MAX_CLIENT_SENDS_PER_RECIPIENT_PER_HOUR = 6;
const GUEST_RSVP_FRESH_MINUTES = 30;
const EVENT_TIMEZONE = "America/Port_of_Spain";
const APP_ORIGIN = "https://www.kretopia.com";
const ALLOWED_HOSTS = new Set(["kretopia.com", "www.kretopia.com", "thrivein.io", "www.thrivein.io"]);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const STATUS_VALUES = new Set(["accepted", "rejected", "shortlisted"]);

export interface EventFacts {
  id: string;
  title: string | null;
  start_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
}

export interface OpportunityFacts {
  created_by: string | null;
  title: string | null;
}

export interface EmailPolicyDeps {
  recentSendCount(recipientEmail: string, sinceMinutes: number): Promise<number>;
  eventFacts(eventId: string): Promise<EventFacts | null>;
  participantRegistered(eventId: string, userId: string): Promise<boolean>;
  guestRsvpRecent(eventId: string, email: string, withinMinutes: number): Promise<boolean>;
  opportunityFacts(opportunityId: string): Promise<OpportunityFacts | null>;
  applicationExists(opportunityId: string, applicantId: string): Promise<boolean>;
}

export interface SendInput {
  templateName: string;
  recipientEmail?: string | null;
  recipientUserId?: string | null;
  templateData: Record<string, unknown>;
}

export type EmailDecision =
  | { allow: true; templateData: Record<string, unknown> }
  | { allow: false; status: number; error: string };

const deny = (status: number, error: string): EmailDecision => ({ allow: false, status, error });

/** A link is kept only if it is https and on one of our own hosts. */
export function safeAppUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 600) return undefined;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

/** The uuid that follows `/<segment>/` in a link, e.g. /event/<uuid>. */
export function idFromUrl(segment: string, value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = new RegExp(`/${segment}/(${UUID})(?:[/?#]|$)`, "i").exec(value);
  return m ? m[1].toLowerCase() : null;
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const t = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: EVENT_TIMEZONE,
  });
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: EVENT_TIMEZONE,
  });
}

export async function authorizeTransactionalSend(
  caller: Caller,
  input: SendInput,
  deps: EmailPolicyDeps,
): Promise<EmailDecision> {
  // Server to server: unchanged behaviour.
  if (caller.kind === "service") return { allow: true, templateData: input.templateData };

  if (!(CLIENT_TEMPLATES as readonly string[]).includes(input.templateName)) {
    return deny(403, "This template cannot be requested from the browser");
  }

  const data = input.templateData ?? {};
  const recipientEmail = isEmail(input.recipientEmail) ? input.recipientEmail.trim().toLowerCase() : null;

  // ── event-registration-confirmation: the person who just registered ──────
  if (input.templateName === "event-registration-confirmation") {
    if (!recipientEmail) return deny(400, "A valid recipient is required");
    const eventId = idFromUrl("event", data.eventUrl);
    if (!eventId) return deny(400, "Event reference is missing");

    const event = await deps.eventFacts(eventId);
    if (!event) return deny(404, "Event not found");

    let proven = false;
    if (caller.kind === "user") {
      if (caller.email && caller.email.toLowerCase() === recipientEmail) {
        proven = await deps.participantRegistered(eventId, caller.userId);
      }
    }
    if (!proven) {
      // Guest RSVP (also a signed-in member RSVPing with another address).
      proven = await deps.guestRsvpRecent(eventId, recipientEmail, GUEST_RSVP_FRESH_MINUTES);
    }
    if (!proven) return deny(403, "No recent registration for this address");

    if ((await deps.recentSendCount(recipientEmail, 60)) >= MAX_CLIENT_SENDS_PER_RECIPIENT_PER_HOUR) {
      return deny(429, "Too many emails for this address, try again later");
    }

    const venue = event.venue_name
      ? event.venue_address ? `${event.venue_name}, ${event.venue_address}` : event.venue_name
      : undefined;
    const token = typeof data.checkInToken === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(data.checkInToken)
      ? data.checkInToken : undefined;

    return {
      allow: true,
      templateData: {
        attendeeName: cleanText(data.attendeeName, 80),
        attendeeEmail: recipientEmail,
        // Event text comes from the event, never from the request.
        eventTitle: cleanText(event.title, 160),
        eventDate: event.start_time ? formatEventDate(event.start_time) : undefined,
        eventTime: event.start_time ? formatEventTime(event.start_time) : undefined,
        eventVenue: cleanText(venue, 240),
        eventUrl: `${APP_ORIGIN}/event/${eventId}`,
        passUrl: safeAppUrl(data.passUrl),
        checkInToken: token,
        isTicketed: data.isTicketed === true,
        isGuest: data.isGuest === true,
        hasAccount: data.hasAccount === true,
      },
    };
  }

  // The remaining templates belong to the hiring flow and need a signed-in member.
  if (caller.kind !== "user") return deny(401, "Sign in to send this email");

  const opportunityId = idFromUrl("opportunity", data.gigUrl);
  if (!opportunityId) return deny(400, "Opportunity reference is missing");
  const opportunity = await deps.opportunityFacts(opportunityId);
  if (!opportunity) return deny(404, "Opportunity not found");

  const gigUrl = `${APP_ORIGIN}/opportunity/${opportunityId}`;
  const gigTitle = cleanText(opportunity.title, 160) ?? cleanText(data.gigTitle, 160);

  // ── application-confirmation: the applicant, to themselves ───────────────
  if (input.templateName === "application-confirmation") {
    if (!recipientEmail || !caller.email || caller.email.toLowerCase() !== recipientEmail) {
      return deny(403, "You can only send this confirmation to yourself");
    }
    if (!(await deps.applicationExists(opportunityId, caller.userId))) {
      return deny(403, "No application found");
    }
    if ((await deps.recentSendCount(recipientEmail, 60)) >= MAX_CLIENT_SENDS_PER_RECIPIENT_PER_HOUR) {
      return deny(429, "Too many emails for this address, try again later");
    }
    return {
      allow: true,
      templateData: { applicantName: cleanText(data.applicantName, 80), gigTitle, gigUrl },
    };
  }

  // ── new-applicant-notification: the poster, about someone who applied ────
  if (input.templateName === "new-applicant-notification") {
    if (!input.recipientUserId || input.recipientUserId !== opportunity.created_by) {
      return deny(403, "Recipient is not the owner of this opportunity");
    }
    if (!(await deps.applicationExists(opportunityId, caller.userId))) {
      return deny(403, "No application found");
    }
    return {
      allow: true,
      templateData: {
        ownerName: cleanText(data.ownerName, 80),
        applicantName: cleanText(data.applicantName, 80),
        gigTitle,
        gigUrl,
      },
    };
  }

  // ── application-status-update: the poster, to an applicant ───────────────
  if (input.templateName === "application-status-update") {
    if (!opportunity.created_by || opportunity.created_by !== caller.userId) {
      return deny(403, "Only the owner of this opportunity can send this update");
    }
    if (!input.recipientUserId || !(await deps.applicationExists(opportunityId, input.recipientUserId))) {
      return deny(403, "That person has not applied");
    }
    const status = typeof data.status === "string" && STATUS_VALUES.has(data.status) ? data.status : undefined;
    if (!status) return deny(400, "Invalid status");
    return {
      allow: true,
      templateData: {
        applicantName: cleanText(data.applicantName, 80),
        gigTitle,
        gigUrl,
        projectUrl: safeAppUrl(data.projectUrl),
        status,
      },
    };
  }

  return deny(403, "This template cannot be requested from the browser");
}
