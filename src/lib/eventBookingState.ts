export type EventBookingState =
  | "loading"
  | "unavailable"
  | "cancelled"
  | "ended"
  | "hosting"
  | "waitlisted"
  | "booked"
  | "sign-in-waitlist"
  | "waitlist"
  | "sold-out"
  | "payment-unavailable"
  | "available";

export function getEventBookingState({
  loading,
  availabilityReady,
  cancelled,
  ended,
  hosting,
  participation,
  full,
  waitlistEnabled,
  authenticated,
  nativePaid,
}: {
  loading: boolean;
  availabilityReady: boolean;
  cancelled: boolean;
  ended: boolean;
  hosting: boolean;
  participation: string | null;
  full: boolean;
  waitlistEnabled: boolean;
  authenticated: boolean;
  nativePaid: boolean;
}): EventBookingState {
  if (loading) return "loading";
  if (cancelled) return "cancelled";
  if (ended) return "ended";
  if (hosting) return "hosting";
  if (participation === "waitlisted") return "waitlisted";
  if (participation) return "booked";
  if (!availabilityReady) return "unavailable";
  if (full) {
    if (!waitlistEnabled) return "sold-out";
    return authenticated ? "waitlist" : "sign-in-waitlist";
  }
  if (nativePaid) return "payment-unavailable";
  return "available";
}

export function getEventBookingLabel(state: EventBookingState): string {
  switch (state) {
    case "loading": return "Checking availability";
    case "unavailable": return "Booking unavailable";
    case "cancelled": return "Cancelled";
    case "ended": return "Ended";
    case "hosting": return "You're hosting";
    case "waitlisted": return "Waitlisted";
    case "booked": return "Going";
    case "sign-in-waitlist": return "Waitlist";
    case "waitlist": return "Waitlist";
    case "sold-out": return "Sold out";
    case "payment-unavailable": return "Tickets unavailable";
    case "available": return "I'm Going";
  }
}

export function getEventBookingReason(state: EventBookingState): string | null {
  switch (state) {
    case "unavailable": return "Availability couldn't be confirmed. Refresh to try again.";
    case "cancelled": return "The host cancelled this event.";
    case "ended": return "Bookings are closed because this event has ended.";
    case "sold-out": return "This event is full and no waitlist is available.";
    case "sign-in-waitlist": return "This event is full. Sign in to join the waitlist.";
    case "payment-unavailable": return "Online ticket sales aren't available for this event.";
    default: return null;
  }
}

/**
 * What the one booking control is in each state. Only a state the viewer can act on is a "primary" call to action; every other state is a
 * fact about the viewer ("Going", "Sold out", "Ended") drawn as a status, not as a second booking-shaped button. Leaving is a quiet action
 * that sits beside the "Going" status, not a button of equal weight.
 */
export interface EventBookingControl {
  label: string;
  kind: "primary" | "status";
  /** Only meaningful for "primary". */
  enabled: boolean;
  /** "Cancel RSVP" is offered beside the status. */
  cancellable: boolean;
  /** The label of that leaving action. */
  cancelLabel: string | null;
}

export function getEventBookingControl(state: EventBookingState): EventBookingControl {
  const status = (label: string, extra: Partial<EventBookingControl> = {}): EventBookingControl => ({ label, kind: "status", enabled: false, cancellable: false, cancelLabel: null, ...extra });
  switch (state) {
    case "available": return { label: getEventBookingLabel(state), kind: "primary", enabled: true, cancellable: false, cancelLabel: null };
    case "waitlist":
    case "sign-in-waitlist": return { label: getEventBookingLabel(state), kind: "primary", enabled: true, cancellable: false, cancelLabel: null };
    case "booked": return status(getEventBookingLabel(state), { cancellable: true, cancelLabel: "Cancel RSVP" });
    case "waitlisted": return status(getEventBookingLabel(state), { cancellable: true, cancelLabel: "Leave waitlist" });
    default: return status(getEventBookingLabel(state));
  }
}

/**
 * "12 places left" or "No places left"; null when the event has no limit, or when the server's count is not known (the booking reason then
 * says so once). The count must be the server's, never an optimistic one.
 */
export function placesLeftLabel(capacity: number, serverCount: number | null): string | null {
  if (!(capacity > 0) || serverCount === null) return null;
  const left = Math.max(0, capacity - serverCount);
  return left === 0 ? "No places left" : `${left} ${left === 1 ? "place" : "places"} left`;
}
