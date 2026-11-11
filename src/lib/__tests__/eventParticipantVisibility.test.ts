import { describe, expect, it } from "vitest";
import { participantVisibilityFilter, participantVisibleTo } from "@/lib/eventParticipantVisibility";

const ME = "11111111-1111-4111-8111-111111111111";

describe("who may see whom in an event's list", () => {
  it("shows a visible row, and a row with no flag, to everyone", () => {
    for (const row of [{ user_id: "u1", is_visible: true }, { user_id: "u1", is_visible: null }, { user_id: "u1" }]) {
      expect(participantVisibleTo(row, null, false)).toBe(true);
      expect(participantVisibleTo(row, ME, false)).toBe(true);
    }
  });

  it("lists a guest RSVP (no account) like any visible row", () => {
    expect(participantVisibleTo({ user_id: null, is_visible: true }, null, false)).toBe(true);
    expect(participantVisibleTo({ user_id: null }, ME, false)).toBe(true);
  });

  it("shows a member who hid themselves only to the host and to themselves", () => {
    const hidden = { user_id: "u1", is_visible: false };
    expect(participantVisibleTo(hidden, null, false)).toBe(false);
    expect(participantVisibleTo(hidden, ME, false)).toBe(false);
    expect(participantVisibleTo(hidden, "u1", false)).toBe(true);
    expect(participantVisibleTo(hidden, "host", true)).toBe(true);
  });

  it("never treats a hidden guest row as the visitor's own: no viewer id matches a row without an account", () => {
    expect(participantVisibleTo({ user_id: null, is_visible: false }, null, false)).toBe(false);
    expect(participantVisibleTo({ user_id: null, is_visible: false }, undefined, false)).toBe(false);
  });
});

describe("the same rule, as the filter sent to the server", () => {
  it("asks for visible rows only for a visitor", () => {
    expect(participantVisibilityFilter(null, false)).toBe("is_visible.is.null,is_visible.eq.true");
  });

  it("adds the member's own row for a signed-in member", () => {
    expect(participantVisibilityFilter(ME, false)).toBe(`is_visible.is.null,is_visible.eq.true,user_id.eq.${ME}`);
  });

  it("asks for every row for the host", () => {
    expect(participantVisibilityFilter("host", true)).toBeNull();
    expect(participantVisibilityFilter(ME, true)).toBeNull();
  });

  it("puts nothing but a plain uuid into the filter", () => {
    expect(participantVisibilityFilter("x,is_visible.eq.false", false)).toBe("is_visible.is.null,is_visible.eq.true");
    expect(participantVisibilityFilter("not-a-uuid", false)).toBe("is_visible.is.null,is_visible.eq.true");
  });
});
