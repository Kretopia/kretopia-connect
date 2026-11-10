import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The two event RSVP calls that have an older twin, so that a person can still RSVP while the database lacks the newer function.
 *
 * Migration 20261109130000 added two functions that serialise RSVPs against capacity: reserve_event_guest_rsvp (a guest's RSVP) and
 * cancel_event_rsvp (leaving an event). The app calls them first. Production's database is the legacy backend, which this repository's
 * migrations do not reach, and on 2026-11-10 it had neither: PostgREST answered 404 PGRST202, so every guest RSVP failed with "Couldn't
 * RSVP" and nobody could cancel. When, and only when, the database says that the function does not exist, the call falls back to what it
 * was before the migration: guest_rsvp_upsert (same arguments, same answer) and a direct update of the member's own participation row.
 * Any other answer, a refusal included, is the answer: it is never retried on the older path. Once the migration is applied the older
 * path is simply never reached.
 */
// A client without the generated types: reserve_event_guest_rsvp is not in them.
const untyped = supabase as unknown as SupabaseClient;

interface RpcError {
  code?: string | null;
  message?: string | null;
}

/**
 * The database does not have the function that was called. PostgREST answers PGRST202 (HTTP 404) when it is not in its schema cache;
 * Postgres answers 42883 when a function is called that does not exist, which only counts when the message names the one called here (a
 * missing helper inside a function that does exist is a different failure and is reported as such).
 */
export const isMissingFunction = (error: RpcError | null | undefined, name: string): boolean =>
  !!error && (error.code === "PGRST202" || (error.code === "42883" && (error.message ?? "").includes(name)));

/** What both guest functions return: the guest's pass token and whether they are going. */
export interface GuestRsvpRow {
  check_in_token?: string | null;
  status?: string | null;
}

/** A guest's RSVP, by name and email. Returns the row the database answered with, or null when it answered with nothing. */
export async function reserveGuestRsvp({ eventId, name, email }: { eventId: string; name: string; email: string }): Promise<GuestRsvpRow | null> {
  const args = { p_event_id: eventId, p_guest_name: name, p_guest_email: email };
  let answer = await untyped.rpc("reserve_event_guest_rsvp", args);
  if (isMissingFunction(answer.error, "reserve_event_guest_rsvp")) answer = await untyped.rpc("guest_rsvp_upsert", args);
  if (answer.error) throw answer.error;
  const data = answer.data as GuestRsvpRow | GuestRsvpRow[] | null;
  return (Array.isArray(data) ? data[0] : data) ?? null;
}

export type CancelRsvpResult = "cancelled" | "not_going";

/** A member leaves an event. "not_going" means the database found no RSVP of theirs to cancel. */
export async function cancelEventRsvp(eventId: string, userId: string): Promise<CancelRsvpResult> {
  const answer = await untyped.rpc("cancel_event_rsvp", { p_event_id: eventId });
  if (!answer.error) return answer.data === "not_going" ? "not_going" : "cancelled";
  if (!isMissingFunction(answer.error, "cancel_event_rsvp")) throw answer.error;
  // Before the function: the member's own row, set to cancelled (which also frees the spot and lets the waitlist move up).
  const { error } = await untyped.from("jam_participants").update({ status: "cancelled" }).eq("jam_id", eventId).eq("user_id", userId);
  if (error) throw error;
  return "cancelled";
}
