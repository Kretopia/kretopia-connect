import { describe, expect, it } from "vitest";
import { buildHiringGlance, type GlanceCreditInput } from "../hiringGlance";
import { creditEvidenceBasis } from "../creditEvidence";

const NOW = new Date("2026-10-08T00:00:00Z");
const credit = (over: Partial<GlanceCreditInput> & { id: string }): GlanceCreditInput => ({
  project_name: `Project ${over.id}`,
  role: "Editor",
  year: null,
  verification_status: "unverified",
  ...over,
});

describe("creditEvidenceBasis", () => {
  it("says why a credit is verified", () => {
    expect(creditEvidenceBasis({ verification_status: "verified", endorsement_count: 2 })).toBe("Confirmed by 2 collaborators");
    expect(creditEvidenceBasis({ verification_status: "verified", endorsement_count: 1 })).toBe("Confirmed by 1 collaborator");
    expect(creditEvidenceBasis({ verification_status: "verified", source: "youtube" })).toBe("Verified on YouTube");
    expect(creditEvidenceBasis({ verification_status: "verified", source: "web_verified" })).toBe("Verified by Kretopia");
  });

  it("never lets a weaker state read as confirmed", () => {
    expect(creditEvidenceBasis({ verification_status: "auto_discovered" })).toBe("Found in public records");
    expect(creditEvidenceBasis({ verification_status: "pending_review" })).toBe("Awaiting confirmation");
    expect(creditEvidenceBasis({ verification_status: "unverified" })).toBe("Self-claimed");
    expect(creditEvidenceBasis({})).toBe("Self-claimed");
  });
});

describe("buildHiringGlance", () => {
  it("does not invent experience when no credit has a year", () => {
    const g = buildHiringGlance([credit({ id: "a" }), credit({ id: "b" })], {}, NOW);
    expect(g.sinceYear).toBeNull();
    expect(g.yearsActive).toBeNull();
  });

  it("derives years from the earliest known year, including one outside the loaded page", () => {
    const loaded = [credit({ id: "a", year: 2022 }), credit({ id: "b", year: 2024 })];
    expect(buildHiringGlance(loaded, {}, NOW).sinceYear).toBe(2022);
    const g = buildHiringGlance(loaded, { earliestYear: 2012 }, NOW);
    expect(g.sinceYear).toBe(2012);
    expect(g.yearsActive).toBe(14);
    expect(g.partial).toBe(false);
  });

  it("counts elapsed years, with 0 for a first credit from this year", () => {
    expect(buildHiringGlance([credit({ id: "a", year: 2026 })], {}, NOW).yearsActive).toBe(0);
    expect(buildHiringGlance([credit({ id: "a", year: 2025 })], {}, NOW).yearsActive).toBe(1);
  });

  it("flags role/proof as partial when only some credits are loaded", () => {
    expect(buildHiringGlance([credit({ id: "a" })], { total: 30 }, NOW).partial).toBe(true);
    expect(buildHiringGlance([credit({ id: "a" })], { total: 1 }, NOW).partial).toBe(false);
  });

  it("uses database counts, not the loaded page size", () => {
    const loaded = [credit({ id: "a", verification_status: "verified" }), credit({ id: "b" })];
    const g = buildHiringGlance(loaded, { total: 40, confirmed: 9 }, NOW);
    expect(g.total).toBe(40);
    expect(g.confirmed).toBe(9);
    expect(g.confirmedShare).toBeCloseTo(0.225);
  });

  it("never reports more confirmed than total, and falls back to loaded rows", () => {
    const g = buildHiringGlance([credit({ id: "a", verification_status: "verified" })], { total: 0, confirmed: 5 }, NOW);
    expect(g.total).toBe(1);
    expect(g.confirmed).toBe(1);
  });

  it("ranks top roles case-insensitively", () => {
    const g = buildHiringGlance(
      [
        credit({ id: "a", role: "Director of Photography" }),
        credit({ id: "b", role: "director of photography" }),
        credit({ id: "c", role: "Editor" }),
        credit({ id: "d", role: "  " }),
      ],
      {},
      NOW,
    );
    expect(g.topRoles).toEqual([
      { role: "Director of Photography", count: 2 },
      { role: "Editor", count: 1 },
    ]);
  });

  it("leads the proof list with confirmed credits, newest first, capped at three", () => {
    const g = buildHiringGlance(
      [
        credit({ id: "self-new", year: 2025 }),
        credit({ id: "ver-old", year: 2018, verification_status: "verified", source: "youtube" }),
        credit({ id: "ver-new", year: 2023, verification_status: "verified", endorsement_count: 2 }),
        credit({ id: "pub", year: 2024, verification_status: "auto_discovered" }),
        credit({ id: "self-old", year: 2010 }),
      ],
      {},
      NOW,
    );
    expect(g.proof.map((p) => p.id)).toEqual(["ver-new", "ver-old", "pub"]);
    expect(g.proof[0].basis).toBe("Confirmed by 2 collaborators");
  });

  it("honours a forced evidence state for project-record credits", () => {
    const g = buildHiringGlance(
      [credit({ id: "icdb", forcedEvidence: "publicly_sourced", forcedBasis: "Claimed from a project record" })],
      {},
      NOW,
    );
    expect(g.confirmed).toBe(0);
    expect(g.proof[0]).toMatchObject({ evidence: "publicly_sourced", basis: "Claimed from a project record" });
  });
});
