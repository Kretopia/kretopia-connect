import { describe, expect, it } from "vitest";
import { closingLabel } from "../GigCard";

const NOW = new Date("2026-10-22T10:00:00Z");

describe("closingLabel", () => {
  it("names the day a gig closes when that day has not passed", () => {
    expect(closingLabel("2026-11-12T23:00:00Z", NOW)).toMatch(/^Closes Nov 1[23]$/);
    expect(closingLabel("2027-01-05T12:00:00Z", NOW)).toMatch(/^Closes Jan [45]$/);
  });

  it.each([
    ["no deadline", null],
    ["an empty one", ""],
    ["one that is not a date", "soon"],
    ["one already past", "2026-10-21T10:00:00Z"],
    ["undefined", undefined],
  ])("says nothing for %s, so no closing date is ever invented", (_name, value) => {
    expect(closingLabel(value as string | null | undefined, NOW)).toBeNull();
  });
});
