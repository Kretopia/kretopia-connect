import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * After the server confirms a paid event ticket (verify-event-ticket answers "paid"), make sure the buyer is on the guest list.
 *
 * Why: kretopia-app's verify-event-ticket seats the buyer with jam_participants status "rsvp", which jam_participants_status_check
 * (interested, going, maybe, declined, cancelled) rejects, and the error is not checked, so a paid buyer is never added. Until that
 * backend is redeployed, the page adds them through rsvp_to_event, the same call a free RSVP makes. It grants nothing new: any
 * signed-in member can already call rsvp_to_event for an event. Once the backend is fixed this answers "present" and does nothing.
 */
export type GuestListOutcome = "present" | "added" | "waitlisted" | "failed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensurePaidBuyerOnGuestList(client: SupabaseClient<any>, eventId: string, userId: string): Promise<GuestListOutcome> {
  try {
    const { data: row } = await client
      .from("jam_participants")
      .select("status")
      .eq("jam_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (row && row.status !== "cancelled") return "present";
    const { data, error } = await client.rpc("rsvp_to_event", { p_event_id: eventId });
    if (error) return "failed";
    if (data === "joined" || data === "already") return "added";
    if (data === "waitlisted") return "waitlisted";
    return "failed";
  } catch {
    return "failed";
  }
}
