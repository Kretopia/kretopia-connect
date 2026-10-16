/**
 * How someone may get into an event, decided in one place so every "Join"
 * button agrees with the event page (EventPage.handleJoinOrSignup).
 *
 * Three of the join buttons used to insert a participant row straight away
 * with no look at the event: the session card, the session dialog for any
 * event whose price lives in ticket tiers (ticket_price is empty there), and
 * the post-onboarding "pending join". Each let someone onto the guest list of
 * a ticketed event without paying. Only a free event may be joined directly.
 */
export type EventEntry =
  | { kind: "free" }
  /** Tickets are sold elsewhere: go there (the event page does the same). */
  | { kind: "external"; url: string }
  /** Kretopia sells the ticket: buy it on the event page, never join directly. */
  | { kind: "ticket" };

export interface EventEntryInput {
  is_ticketed?: boolean | null;
  external_ticket_url?: string | null;
}

function httpUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function eventEntry(event: EventEntryInput | null | undefined): EventEntry {
  const url = httpUrl(event?.external_ticket_url);
  if (url) return { kind: "external", url };
  if (event?.is_ticketed) return { kind: "ticket" };
  return { kind: "free" };
}

/** For callers that only need the yes/no: true only for an event we positively know is free. */
export function canJoinDirectly(event: EventEntryInput | null | undefined): boolean {
  return !!event && eventEntry(event).kind === "free";
}
