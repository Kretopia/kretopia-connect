import { describe, expect, it } from "vitest";
import { scoutEvidence } from "../scoutEvidence";

describe("scoutEvidence", () => {
  it("keeps the matches and drops the relative date and the pay the card already shows", () => {
    const out = scoutEvidence({
      fit_reason: "Matches your “motion design” · Remote · posted yesterday · $60k / year.",
      compensation: "$60k / year",
      source: "gigboard",
    });
    expect(out).toEqual({ lines: ["Matches your “motion design”", "Remote"], summarised: false });
  });

  it("marks model-written text as summarised and drops the appended 'Posted … ago'", () => {
    const out = scoutEvidence({
      fit_reason: "Brand-film role that wants a motion lead · Posted 2 days ago",
      source: "web",
    });
    expect(out).toEqual({ lines: ["Brand-film role that wants a motion lead"], summarised: true });
  });

  it("returns null when only a date was left, never an empty box", () => {
    expect(scoutEvidence({ fit_reason: "posted yesterday.", source: "gigboard" })).toBeNull();
    expect(scoutEvidence({ fit_reason: "Posted 3 days ago", source: "web" })).toBeNull();
    expect(scoutEvidence({ fit_reason: "   ", source: "web" })).toBeNull();
    expect(scoutEvidence({ fit_reason: null })).toBeNull();
  });

  it("does not drop a sentence only because it mentions a duration", () => {
    const out = scoutEvidence({ fit_reason: "Asks for 3 years of editing experience", source: "web" });
    expect(out?.lines).toEqual(["Asks for 3 years of editing experience"]);
  });

  it("removes repeats and caps the list", () => {
    const out = scoutEvidence({ fit_reason: "A · a · B · C · D · E · F", source: "gigboard" });
    expect(out?.lines).toEqual(["A", "B", "C", "D"]);
  });

  it("adds nothing of its own: no score, no superlative", () => {
    const out = scoutEvidence({ fit_reason: "Matches your “video editor”", source: "gigboard" })!;
    expect(out.lines.join(" ")).not.toMatch(/%|strongest|best|top/i);
  });
});
