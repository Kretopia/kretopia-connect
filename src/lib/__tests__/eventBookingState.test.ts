import { describe, expect, it } from "vitest";
import { getEventBookingLabel, getEventBookingReason, getEventBookingState } from "@/lib/eventBookingState";

const available = {
  loading: false,
  availabilityReady: true,
  cancelled: false,
  ended: false,
  hosting: false,
  participation: null,
  full: false,
  waitlistEnabled: false,
  authenticated: false,
  nativePaid: false,
};

describe("event booking state", () => {
  it("fails closed when the event is sold out or ended", () => {
    const soldOut = getEventBookingState({ ...available, full: true });
    const ended = getEventBookingState({ ...available, ended: true });
    expect(getEventBookingLabel(soldOut)).toBe("Sold out");
    expect(getEventBookingReason(soldOut)).toContain("no waitlist");
    expect(getEventBookingLabel(ended)).toBe("Event ended");
  });

  it("does not allow native paid booking without a verified payment flow", () => {
    const state = getEventBookingState({ ...available, nativePaid: true });
    expect(getEventBookingLabel(state)).toBe("Booking unavailable");
    expect(getEventBookingReason(state)).toContain("payment booking isn't available");
  });

  it("offers a waitlist only when the server supports it and the user is signed in", () => {
    expect(getEventBookingState({ ...available, full: true, waitlistEnabled: true, authenticated: true })).toBe("waitlist");
    const guest = getEventBookingState({ ...available, full: true, waitlistEnabled: true });
    expect(guest).toBe("sign-in-waitlist");
    expect(getEventBookingReason(guest)).toContain("Sign in");
  });
});
