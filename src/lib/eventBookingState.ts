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
    case "ended": return "Event ended";
    case "hosting": return "You're hosting";
    case "waitlisted": return "Waitlisted";
    case "booked": return "You're going";
    case "sign-in-waitlist": return "Sign in for waitlist";
    case "waitlist": return "Join waitlist";
    case "sold-out": return "Sold out";
    case "payment-unavailable": return "Booking unavailable";
    case "available": return "Book";
  }
}

export function getEventBookingReason(state: EventBookingState): string | null {
  switch (state) {
    case "unavailable": return "Availability couldn't be confirmed. Refresh to try again.";
    case "cancelled": return "The host cancelled this event.";
    case "ended": return "Bookings are closed because this event has ended.";
    case "sold-out": return "This event is full and no waitlist is available.";
    case "sign-in-waitlist": return "This event is full. Sign in to join the waitlist.";
    case "payment-unavailable": return "Online payment booking isn't available for this event.";
    default: return null;
  }
}
