import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * A member's own calendar of events. It is a list of its own (public.event_calendar_entries), kept apart from attendance: putting an event
 * on a calendar is not an RSVP, a ticket or a reservation, so nothing here reads or writes jam_participants, and no count changes.
 *
 * The table is not in the generated types until its migration is applied, so it is reached through an untyped client. Until it exists
 * the functions say "unavailable" instead of failing, so the page can say so honestly and still offer the external export.
 */
// A client without the generated types: the table is not in them until its migration has been applied and they are regenerated.
const untyped = supabase as unknown as SupabaseClient;
const entries = () => untyped.from("event_calendar_entries");

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/** The table does not exist (its migration has not been applied): PostgREST says PGRST205, Postgres says 42P01. */
export const isMissingRelation = (error: DbError): boolean =>
  !!error && (error.code === "PGRST205" || error.code === "42P01" || /could not find the table|relation .* does not exist/i.test(error.message ?? ""));

export interface CalendarEntries {
  /** The events on the member's calendar. */
  ids: Set<string>;
  /** False when saving to the Kretopia calendar cannot work (signed out, or the table does not exist yet). */
  available: boolean;
  error: string | null;
}

export type CalendarSaveResult =
  | { ok: true }
  | { ok: false; reason: "signed-out" | "unavailable" | "failed"; message: string };

export async function fetchCalendarEntries(userId: string | null): Promise<CalendarEntries> {
  if (!userId) return { ids: new Set(), available: false, error: null };
  const { data, error } = await entries().select("event_id").eq("user_id", userId);
  if (error) {
    if (isMissingRelation(error)) return { ids: new Set(), available: false, error: null };
    return { ids: new Set(), available: true, error: error.message || "Your calendar could not be loaded." };
  }
  return { ids: new Set((data ?? []).map((row: { event_id: string }) => row.event_id)), available: true, error: null };
}

export async function addToKretopiaCalendar(userId: string | null, eventId: string): Promise<CalendarSaveResult> {
  if (!userId) return { ok: false, reason: "signed-out", message: "Sign in to add events to your calendar." };
  // Saving twice is not an error: the row is already there, which is what was asked for.
  const { error } = await entries().upsert({ user_id: userId, event_id: eventId }, { onConflict: "user_id,event_id", ignoreDuplicates: true });
  if (!error) return { ok: true };
  if (isMissingRelation(error)) return { ok: false, reason: "unavailable", message: "Saving to your Kretopia calendar isn't available yet." };
  return { ok: false, reason: "failed", message: error.message || "The event could not be added to your calendar." };
}

export async function removeFromKretopiaCalendar(userId: string | null, eventId: string): Promise<CalendarSaveResult> {
  if (!userId) return { ok: false, reason: "signed-out", message: "Sign in to manage your calendar." };
  const { error } = await entries().delete().eq("user_id", userId).eq("event_id", eventId);
  if (!error) return { ok: true };
  if (isMissingRelation(error)) return { ok: false, reason: "unavailable", message: "Your Kretopia calendar isn't available yet." };
  return { ok: false, reason: "failed", message: error.message || "The event could not be removed from your calendar." };
}

const compactUtc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export interface ExternalCalendarEvent {
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  url?: string;
}

/** A Google Calendar "add event" link for the same event the .ics download describes (two hours when there is no end). */
export function googleCalendarUrl(event: ExternalCalendarEvent): string {
  const start = new Date(event.startTime).getTime();
  const end = event.endTime ? new Date(event.endTime).getTime() : start + 2 * 60 * 60 * 1000;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${compactUtc(new Date(start).toISOString())}/${compactUtc(new Date(end).toISOString())}`,
  });
  const details = [event.description, event.url ? `Details: ${event.url}` : null].filter(Boolean).join("\n\n");
  if (details) params.set("details", details);
  const location = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
  if (location) params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
