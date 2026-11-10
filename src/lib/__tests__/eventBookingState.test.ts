import { describe, expect, it } from "vitest";
import { getEventBookingControl, getEventBookingLabel, getEventBookingReason, getEventBookingState, placesLeftLabel, type EventBookingState } from "@/lib/eventBookingState";

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
    expect(getEventBookingLabel(ended)).toBe("Ended");
  });

  it("uses one state-aware label for the primary I'm Going action", () => {
    expect(getEventBookingLabel(getEventBookingState(available))).toBe("I'm Going");
    expect(getEventBookingLabel(getEventBookingState({ ...available, participation: "going" }))).toBe("Going");
    expect(getEventBookingLabel(getEventBookingState({ ...available, full: true, waitlistEnabled: true, authenticated: true }))).toBe("Waitlist");
  });

  it("does not allow native paid booking without a verified payment flow", () => {
    const state = getEventBookingState({ ...available, nativePaid: true });
    expect(getEventBookingLabel(state)).toBe("Tickets unavailable");
    expect(getEventBookingReason(state)).toContain("ticket sales aren't available");
  });

  it("offers a waitlist only when the server supports it and the user is signed in", () => {
    expect(getEventBookingState({ ...available, full: true, waitlistEnabled: true, authenticated: true })).toBe("waitlist");
    const guest = getEventBookingState({ ...available, full: true, waitlistEnabled: true });
    expect(guest).toBe("sign-in-waitlist");
    expect(getEventBookingReason(guest)).toContain("Sign in");
  });
});

describe("the one booking control", () => {
  const ALL: EventBookingState[] = ["loading", "unavailable", "cancelled", "ended", "hosting", "waitlisted", "booked", "sign-in-waitlist", "waitlist", "sold-out", "payment-unavailable", "available"];

  it("is a primary call to action only where the viewer can act: I'm Going, or Waitlist", () => {
    const primary = ALL.filter((state) => getEventBookingControl(state).kind === "primary");
    expect(primary.sort()).toEqual(["available", "sign-in-waitlist", "waitlist"]);
    expect(getEventBookingControl("available")).toMatchObject({ label: "I'm Going", enabled: true });
    expect(getEventBookingControl("waitlist")).toMatchObject({ label: "Waitlist", enabled: true });
    expect(getEventBookingControl("sign-in-waitlist")).toMatchObject({ label: "Waitlist", enabled: true });
  });

  it("is a status, never a second button-shaped control, in every other state", () => {
    for (const state of ALL.filter((candidate) => !["available", "waitlist", "sign-in-waitlist"].includes(candidate))) {
      const control = getEventBookingControl(state);
      expect(control.kind, state).toBe("status");
      expect(control.enabled, state).toBe(false);
      expect(control.label, state).toBe(getEventBookingLabel(state));
    }
    expect(getEventBookingControl("sold-out").label).toBe("Sold out");
    expect(getEventBookingControl("ended").label).toBe("Ended");
    expect(getEventBookingControl("cancelled").label).toBe("Cancelled");
  });

  it("offers leaving only beside Going and Waitlisted", () => {
    expect(getEventBookingControl("booked")).toMatchObject({ label: "Going", cancellable: true, cancelLabel: "Cancel RSVP" });
    expect(getEventBookingControl("waitlisted")).toMatchObject({ label: "Waitlisted", cancellable: true, cancelLabel: "Leave waitlist" });
    for (const state of ALL.filter((candidate) => !["booked", "waitlisted"].includes(candidate))) {
      expect(getEventBookingControl(state).cancellable, state).toBe(false);
    }
  });

  it("walks Join, confirmed, Cancel as three labels of the same control", () => {
    const labels = [available, { ...available, participation: "going" }, available].map((input) => getEventBookingControl(getEventBookingState(input)).label);
    expect(labels).toEqual(["I'm Going", "Going", "I'm Going"]);
  });
});

describe("places left", () => {
  it("is said only for a limited event, from the server's count", () => {
    expect(placesLeftLabel(0, 12)).toBeNull();
    expect(placesLeftLabel(20, 12)).toBe("8 places left");
    expect(placesLeftLabel(20, 19)).toBe("1 place left");
    expect(placesLeftLabel(20, 20)).toBe("No places left");
    expect(placesLeftLabel(20, 25)).toBe("No places left");
  });

  it("is not said at all while the server's count is not known (no optimistic number)", () => {
    expect(placesLeftLabel(20, null)).toBeNull();
  });
});
