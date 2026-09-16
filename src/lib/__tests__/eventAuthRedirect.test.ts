import { describe, it, expect } from "vitest";
import { buildEventAuthUrl, computePostAuthRedirect } from "../eventAuthRedirect";

/**
 * E2E-style contract tests for the unauthenticated RSVP round-trip:
 *
 *   guest taps RSVP on /event/:id (host requires account)
 *     → EventPage navigates to buildEventAuthUrl(id)
 *     → Auth reads ?event=:id and computePostAuthRedirect returns /event/:id
 *     → after signup the user lands back on the event page
 */
describe("event RSVP auth round-trip", () => {
  const EVENT_ID = "evt_abc123";

  it("sends guest to /auth with event id and signup tab", () => {
    expect(buildEventAuthUrl(EVENT_ID)).toBe(`/auth?event=${EVENT_ID}&tab=signup`);
  });

  it("Auth returns guest to the event page after signup", () => {
    // Simulate Auth.tsx parsing the URL produced by buildEventAuthUrl
    const url = new URL("https://kretopia.com" + buildEventAuthUrl(EVENT_ID));
    const eventId = url.searchParams.get("event");
    expect(eventId).toBe(EVENT_ID);

    const target = computePostAuthRedirect({ eventId });
    expect(target).toBe(`/event/${EVENT_ID}`);
  });

  it("event redirect wins over ?redirect= and stashed redirects", () => {
    expect(
      computePostAuthRedirect({
        eventId: EVENT_ID,
        redirectParam: "/somewhere-else",
        stashedRedirect: "/also-not-this",
      })
    ).toBe(`/event/${EVENT_ID}`);
  });

  it("claim flow takes priority over event redirect", () => {
    expect(
      computePostAuthRedirect({ eventId: EVENT_ID, claimProfileId: "profile_1" })
    ).toBe("/profile/profile_1?showClaim=true");
  });

  it("falls back to ?redirect=, then stash, then default", () => {
    expect(computePostAuthRedirect({ redirectParam: "/foo" })).toBe("/foo");
    expect(computePostAuthRedirect({ stashedRedirect: "/bar" })).toBe("/bar");
    expect(computePostAuthRedirect({})).toBe("/");
    expect(computePostAuthRedirect({ fallback: "/home" })).toBe("/home");
  });

  it("round-trip preserves event ids that contain url-safe characters", () => {
    const id = "evt-2026_05-14-bali";
    const target = computePostAuthRedirect({
      eventId: new URL("https://x.test" + buildEventAuthUrl(id)).searchParams.get("event"),
    });
    expect(target).toBe(`/event/${id}`);
  });
});
