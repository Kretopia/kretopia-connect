import { describe, expect, it } from "vitest";
import { getEventCountdown } from "@/lib/eventCountdown";

describe("getEventCountdown", () => {
  it("counts down from an ISO timestamp without depending on the browser timezone", () => {
    expect(getEventCountdown("2026-03-08T09:30:00-04:00", Date.parse("2026-03-08T13:00:00Z"))).toEqual({
      days: 0,
      hours: 0,
      minutes: 30,
      ended: false,
    });
  });

  it("returns an ended state for a timestamp that has passed", () => {
    expect(getEventCountdown("2026-03-08T12:59:00Z", Date.parse("2026-03-08T13:00:00Z"))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      ended: true,
    });
  });

  it("returns null for a missing or invalid timestamp", () => {
    expect(getEventCountdown(undefined, 0)).toBeNull();
    expect(getEventCountdown("not-a-date", 0)).toBeNull();
  });
});
