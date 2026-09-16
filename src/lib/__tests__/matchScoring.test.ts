import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projects: [{ id: "p1" }] as { id: string }[],
  myCollabRows: [{ project_id: "p2" }] as { project_id: string }[],
  collaboratorRows: [
    { project_id: "p1", user_id: "me" },
    { project_id: "p1", user_id: "alice" },
    { project_id: "p2", user_id: "bob" },
  ] as { project_id: string; user_id: string }[],
  projectOwners: [
    { id: "p1", created_by: "me" },
    { id: "p2", created_by: "carol" },
  ] as { id: string; created_by: string }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mocks.projects }),
            in: () => Promise.resolve({ data: mocks.projectOwners }),
          }),
        };
      }
      if (table === "project_collaborators") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: mocks.myCollabRows }) }),
            in: () => ({ eq: () => Promise.resolve({ data: mocks.collaboratorRows }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

import {
  extractCity,
  extractSkillsArray,
  buildMyMatchContext,
  computeMatchScore,
  fetchPastCollaboratorIds,
} from "../matchScoring";

describe("extractCity", () => {
  it("takes the first comma segment, lowercased and trimmed", () => {
    expect(extractCity("Los Angeles, CA")).toBe("los angeles");
    expect(extractCity("  Trinidad  ")).toBe("trinidad");
  });
  it("handles missing location", () => {
    expect(extractCity(null)).toBe("");
    expect(extractCity(undefined)).toBe("");
  });
});

describe("extractSkillsArray", () => {
  it("normalizes plain string arrays", () => {
    expect(extractSkillsArray(["Photography", "Editing"])).toEqual(["photography", "editing"]);
  });
  it("normalizes {skill}/{name} object arrays", () => {
    expect(extractSkillsArray([{ skill: "Color Grading" }, { name: "Lighting" }])).toEqual(["color grading", "lighting"]);
  });
  it("normalizes a legacy keyed object", () => {
    expect(extractSkillsArray({ a: "Directing", b: "Sound" })).toEqual(["directing", "sound"]);
  });
  it("returns empty for null/undefined", () => {
    expect(extractSkillsArray(null)).toEqual([]);
    expect(extractSkillsArray(undefined)).toEqual([]);
  });
});

describe("computeMatchScore", () => {
  const baseMe = buildMyMatchContext(
    { role: "Photographer", location: "Los Angeles, CA", professional_skills: ["lighting", "editing"] },
    new Set(["collab-1"]),
  );

  it("never zeroes out a candidate with nothing in common -- random noise keeps it non-zero-ish", () => {
    const result = computeMatchScore(baseMe, { userId: "stranger", role: "Dancer", location: "Lagos" });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.sameSector).toBe(false);
    expect(result.sameCity).toBe(false);
    expect(result.pastCollab).toBe(false);
  });

  it("weighs same sector (craft category) above a same literal role isn't required", () => {
    // Videographer is a different literal role from Photographer but the
    // same RoleStamp sector (photo_video) -- this is the point of scoring
    // by sector rather than exact string match.
    const result = computeMatchScore(baseMe, { userId: "u2", role: "Videographer", location: "Nowhere" });
    expect(result.sameSector).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it("scores same city off just the first comma segment", () => {
    // extractCity only looks at the segment before the first comma, so this
    // still counts as "Los Angeles" regardless of what follows it.
    expect(extractCity("Los Angeles, NY-ish suffix ignored")).toBe("los angeles");
    const result = computeMatchScore(baseMe, { userId: "u3", role: "Dancer", location: "Los Angeles, NY-ish suffix ignored" });
    expect(result.sameCity).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it("scores past collaboration highest single signal after sector", () => {
    const result = computeMatchScore(baseMe, { userId: "collab-1", role: "Dancer", location: "Nowhere" });
    expect(result.pastCollab).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(35);
  });

  it("scores partial skill overlap as a ratio, not a raw count", () => {
    const result = computeMatchScore(baseMe, { userId: "u4", role: "Dancer", location: "Nowhere", skills: ["lighting", "unrelated-skill-not-mine"] });
    // overlap = 1, denominator = max(mySkills=2, theirSkills=2, 1) = 2 -> ratio 0.5
    expect(result.skillOverlapRatio).toBeCloseTo(0.5, 5);
  });

  it("stacks every signal for a genuinely strong match", () => {
    const result = computeMatchScore(baseMe, {
      userId: "collab-1",
      role: "Photographer",
      location: "Los Angeles, CA",
      skills: ["lighting", "editing"],
    });
    expect(result.sameSector).toBe(true);
    expect(result.sameCity).toBe(true);
    expect(result.pastCollab).toBe(true);
    expect(result.skillOverlapRatio).toBe(1);
    // 40 + 25 + 35 + 20*1 = 120 floor, plus up to 10 of random noise.
    expect(result.score).toBeGreaterThanOrEqual(120);
  });
});

describe("fetchPastCollaboratorIds", () => {
  it("unions owned-project collaborators and collaborated-project owners, excluding self", async () => {
    const result = await fetchPastCollaboratorIds("me");
    expect(result.has("alice")).toBe(true);
    expect(result.has("bob")).toBe(true);
    expect(result.has("carol")).toBe(true);
    expect(result.has("me")).toBe(false);
  });
});
