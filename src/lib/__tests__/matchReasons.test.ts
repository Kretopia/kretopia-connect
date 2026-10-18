import { describe, expect, it } from "vitest";
import { buildMatchReasons, RECENT_ACTIVITY_DAYS } from "../matchReasons";
import {
  buildMyMatchContext,
  COMPLEMENTARY_CRAFT_WEIGHT,
  computeMatchScore,
  MATCH_SCORE_MAX,
  NEW_SKILL_WEIGHT,
} from "../matchScoring";

const NOW = Date.parse("2026-10-18T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const labels = (input: Parameters<typeof buildMatchReasons>[0]) => buildMatchReasons({ now: NOW, ...input }).map((r) => r.label);

describe("buildMatchReasons: only what is true of these two people", () => {
  it("says nothing when no signal applies, instead of inventing a reason", () => {
    expect(labels({})).toEqual([]);
    expect(labels({ signals: { sameSector: false, sameCity: false, pastCollab: false, skillOverlapRatio: 0, sharedSkills: [] } })).toEqual([]);
  });

  it("names the evidence: the role, the shared skills, the city", () => {
    expect(
      labels({
        signals: { sameSector: true, sameCity: true, pastCollab: false, skillOverlapRatio: 0.5, sharedSkills: ["colour grading", "editing"] },
        role: "Colourist",
        location: "Port of Spain, Trinidad",
        max: 5,
      }),
    ).toEqual(["Shared craft · Colourist", "Shared skills: Colour grading, Editing", "Based in Port of Spain"]);
  });

  it("orders strongest first: worked together, craft, skills, city, activity, openness", () => {
    expect(
      labels({
        signals: { sameSector: true, sameCity: true, pastCollab: true, skillOverlapRatio: 1, sharedSkills: ["lighting"] },
        role: "Photographer",
        location: "Lagos",
        lastActiveAt: daysAgo(2),
        collabIntent: "seeking_collaborators",
        max: 10,
      }),
    ).toEqual([
      "You've worked together before",
      "Shared craft · Photographer",
      "Shared skills: Lighting",
      "Based in Lagos",
      "Active in the last 2 weeks",
      "Open to collaborating",
    ]);
  });

  it("keeps the strongest few by default and a different number on request", () => {
    const input = {
      signals: { sameSector: true, sameCity: true, pastCollab: true, skillOverlapRatio: 1, sharedSkills: ["a"] },
      role: "R",
      location: "L",
    };
    expect(buildMatchReasons({ ...input, now: NOW })).toHaveLength(3);
    expect(buildMatchReasons({ ...input, now: NOW, max: 2 }).map((r) => r.key)).toEqual(["past-collab", "shared-craft"]);
    expect(buildMatchReasons({ ...input, now: NOW, max: 0 })).toEqual([]);
  });

  it("lists at most three skills and counts the rest", () => {
    const [skills] = buildMatchReasons({
      signals: { skillOverlapRatio: 1, sharedSkills: ["a", "b", "c", "d", "e"] },
      now: NOW,
    });
    expect(skills.label).toBe("Shared skills: A, B, C +2");
  });

  it("falls back to 'Similar skills' only when a source knows the ratio but not the names, and not below 30%", () => {
    expect(labels({ signals: { skillOverlapRatio: 0.4 } })).toEqual(["Similar skills"]);
    expect(labels({ signals: { skillOverlapRatio: 0.3 } })).toEqual([]);
  });

  it("counts activity only inside the window, and ignores a missing, invalid or future date", () => {
    expect(labels({ lastActiveAt: daysAgo(RECENT_ACTIVITY_DAYS) })).toEqual(["Active in the last 2 weeks"]);
    expect(labels({ lastActiveAt: daysAgo(RECENT_ACTIVITY_DAYS + 1) })).toEqual([]);
    expect(labels({ lastActiveAt: "not a date" })).toEqual([]);
    expect(labels({ lastActiveAt: daysAgo(-3) })).toEqual([]);
    expect(labels({ lastActiveAt: null })).toEqual([]);
  });

  it("reports openness only for their own 'seeking collaborators', never from another intent", () => {
    expect(labels({ collabIntent: "seeking_collaborators" })).toEqual(["Open to collaborating"]);
    for (const other of ["looking_to_hire", "available_for_hire", "open_to_trade", "", null, undefined]) {
      expect(labels({ collabIntent: other })).toEqual([]);
    }
  });

  it("does not print an empty role or city", () => {
    expect(labels({ signals: { sameSector: true }, role: "  " })).toEqual(["Shared craft"]);
    expect(labels({ signals: { sameCity: true }, location: "" })).toEqual(["Based in your city"]);
  });

  it("never puts a number that could read as a percentage in a reason", () => {
    const all = labels({
      signals: { sameSector: true, sameCity: true, pastCollab: true, skillOverlapRatio: 1, sharedSkills: ["a"] },
      role: "Editor",
      location: "Lagos",
      lastActiveAt: daysAgo(1),
      collabIntent: "seeking_collaborators",
      max: 10,
    });
    for (const label of all) expect(label).not.toMatch(/%|match/i);
  });
});

describe("the ranking weight is not a percentage", () => {
  it("can exceed 100 for a perfect candidate, which is why it is never shown", () => {
    const me = buildMyMatchContext({ role: "Photographer", location: "Lagos, NG", professional_skills: ["lighting"] }, new Set(["c"]), "viewer");
    const best = computeMatchScore(me, { userId: "c", role: "Photographer", location: "Lagos, NG", skills: ["lighting"] });
    expect(best.sameSector && best.sameCity && best.pastCollab).toBe(true);
    expect(best.score).toBeGreaterThan(100);
    expect(best.score).toBeLessThanOrEqual(MATCH_SCORE_MAX);
    expect(MATCH_SCORE_MAX).toBe(130);
  });

  it("exposes the shared skills it was built from, so a reason can name them", () => {
    const me = buildMyMatchContext({ role: "Editor", professional_skills: ["Lighting", "Editing"] }, new Set(), "viewer");
    const result = computeMatchScore(me, { userId: "x", skills: ["editing", "Sound", "EDITING"] });
    expect(result.sharedSkills).toEqual(["editing"]);
  });
});

describe("similar versus complementary", () => {
  it("names a complementary craft and the skills they bring, and never calls the same craft complementary", () => {
    expect(
      labels({
        signals: { complementaryCraft: true, sameSector: false, newSkills: ["colour grading", "sound design"], skillOverlapRatio: 0, sharedSkills: [] },
        role: "Colourist",
        max: 5,
      }),
    ).toEqual(["Complements your craft · Colourist", "Brings skills you don't list: Colour grading, Sound design"]);

    expect(labels({ signals: { complementaryCraft: true, sameSector: true } , role: "Photographer" })).toEqual(["Shared craft · Photographer"]);
  });

  it("only counts skills they bring when the craft is a complement (a bare long skill list proves nothing)", () => {
    expect(labels({ signals: { complementaryCraft: false, newSkills: ["a", "b"] } })).toEqual([]);
    expect(labels({ signals: { newSkills: ["a"] } })).toEqual([]);
  });

  it("caps the skills they bring at three and counts the rest", () => {
    const [, brought] = buildMatchReasons({
      signals: { complementaryCraft: true, newSkills: ["a", "b", "c", "d"], skillOverlapRatio: 0 },
      role: "R",
      now: NOW,
      max: 5,
    });
    expect(brought.label).toBe("Brings skills you don't list: A, B, C +1");
  });

  it("puts 'already interested in you' first: it is the one fact that is mutual", () => {
    const all = labels({
      likedYou: true,
      signals: { sameSector: true, pastCollab: true, skillOverlapRatio: 0 },
      role: "Editor",
      max: 5,
    });
    expect(all[0]).toBe("Already interested in you");
    expect(labels({ likedYou: false })).toEqual([]);
    expect(labels({})).toEqual([]);
  });
});

describe("the complementary weight keeps the ceiling where it was", () => {
  it("a complement with two skills you lack is worth the same 40 as the same craft", () => {
    expect(COMPLEMENTARY_CRAFT_WEIGHT + 2 * NEW_SKILL_WEIGHT).toBe(40);
  });

  it("scores a photographer's complement above a stranger and level with a same-craft candidate", () => {
    const me = buildMyMatchContext({ role: "Photographer", professional_skills: ["lighting"] }, new Set(), "viewer");
    const nothing = computeMatchScore(me, { userId: "n", role: "Chef", skills: [] });
    const stylist = computeMatchScore(me, { userId: "s", role: "Fashion stylist", skills: ["wardrobe", "set styling"] });
    const same = computeMatchScore(me, { userId: "p", role: "Videographer", skills: [] });
    expect(stylist.complementaryCraft).toBe(true);
    expect(stylist.sameSector).toBe(false);
    expect(stylist.newSkills).toEqual(["wardrobe", "set styling"]);
    expect(same.sameSector).toBe(true);
    expect(same.complementaryCraft).toBe(false);
    expect(stylist.score).toBeGreaterThan(nothing.score + 30);
    // 40 against 40, apart from the per-candidate jitter (under 10 either way)
    expect(Math.abs(stylist.score - same.score)).toBeLessThan(10);
  });

  it("never exceeds the documented ceiling, whichever case a candidate is in", () => {
    const me = buildMyMatchContext({ role: "Photographer", location: "Lagos", professional_skills: ["lighting"] }, new Set(["x"]), "v");
    const best = computeMatchScore(me, { userId: "x", role: "Fashion stylist", location: "Lagos", skills: ["lighting", "a", "b", "c"] });
    expect(best.complementaryCraft).toBe(true);
    expect(best.score).toBeLessThanOrEqual(MATCH_SCORE_MAX);
  });

  it("gives a complement no skills bonus for skills it lists that you already have", () => {
    const me = buildMyMatchContext({ role: "Photographer", professional_skills: ["wardrobe"] }, new Set(), "viewer");
    const r = computeMatchScore(me, { userId: "s", role: "Fashion stylist", skills: ["wardrobe"] });
    expect(r.newSkills).toEqual([]);
    expect(r.sharedSkills).toEqual(["wardrobe"]);
  });
});
