import { describe, expect, it } from "vitest";
import { summarizeScoutedGigs, type ScoutedGigSummary } from "../scoutGigSummary";

const gig = (over: Partial<ScoutedGigSummary> = {}): ScoutedGigSummary => ({
  id: "g", title: "Motion Designer", company: "Nord Films", location: "Paris", remote: false, compensation: null,
  fit_reason: "Matches your motion", source_name: "Remote OK", ...over,
});

describe("summarizeScoutedGigs", () => {
  it("is empty when there is nothing to show", () => {
    expect(summarizeScoutedGigs([])).toBe("");
  });

  it("lists each gig with where, pay and source, says when pay is not listed, and gives no fit percentage", () => {
    const text = summarizeScoutedGigs([gig(), gig({ title: "Colorist", company: null, remote: true, location: null, compensation: "€450/day", fit_reason: null })]);
    expect(text).toContain("Gigs currently on my Scout list:");
    expect(text).toContain("1. Motion Designer at Nord Films (Paris) · pay not listed · via Remote OK — Matches your motion");
    expect(text).toContain("2. Colorist (remote) · pay: €450/day · via Remote OK");
    expect(text).not.toContain("null");
    expect(text).not.toMatch(/\d+%|\bfit \d/);
  });

  it("does not pass on the date the scan froze into the reason", () => {
    const text = summarizeScoutedGigs([gig({ fit_reason: "Matches your “motion” · posted yesterday · Posted 2 days ago", source: "gigboard" })]);
    expect(text).toContain("Matches your “motion”");
    expect(text).not.toMatch(/yesterday|days ago/i);
  });

  it("caps the list and says how many were left out", () => {
    const many = Array.from({ length: 15 }, (_, i) => gig({ id: `g${i}`, title: `Gig ${i + 1}` }));
    const text = summarizeScoutedGigs(many);
    expect(text).toContain("12. Gig 12");
    expect(text).not.toContain("13. Gig 13");
    expect(text).toContain("(+3 more not listed)");
  });

  it("keeps long fields short so the prompt stays small", () => {
    const text = summarizeScoutedGigs([gig({ title: "T".repeat(300), fit_reason: "R".repeat(500) })]);
    expect(text.length).toBeLessThan(500);
    expect(text).toContain("…");
  });
});
