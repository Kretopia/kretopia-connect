import { describe, expect, it } from "vitest";
import { CRAFT_CATEGORIES, matchNeedSchema, needToCriteria } from "../need";

describe("matchNeedSchema", () => {
  it("accepts a need and fills the empty lists", () => {
    const need = matchNeedSchema.parse({ craft: { category: "creator", importance: "required" } });
    expect(need.skills).toEqual([]);
    expect(need.platforms).toEqual([]);
    expect(need.themes).toEqual([]);
  });

  it("offers every craft the role stamps know", () => {
    expect(CRAFT_CATEGORIES).toContain("creator");
    expect(CRAFT_CATEGORIES).toContain("photo_video");
  });

  it("rejects what a form or a model could get wrong", () => {
    const bad = (input: unknown) => expect(matchNeedSchema.safeParse(input).success).toBe(false);
    bad({ craft: { category: "wizard", importance: "required" } });
    bad({ craft: { category: "music", importance: "must" } });
    bad({ skills: [{ term: "x", importance: "required" }] }); // too short
    bad({ skills: Array.from({ length: 9 }, (_, i) => ({ term: `skill ${i}`, importance: "preferred" })) });
    bad({ platforms: [{ platform: "myspace", importance: "required" }] });
    bad({ platforms: [{ platform: "tiktok", minAudience: -5, importance: "required" }] });
    bad({ platforms: [{ platform: "tiktok", minAudience: 1.5, importance: "required" }] });
    bad({ location: { text: "P", importance: "required" } });
    bad({ audience: { description: "ab", importance: "required" } });
  });

  it("trims text and ignores nothing else a model might add", () => {
    const need = matchNeedSchema.parse({ skills: [{ term: "  Video editing ", importance: "required" }], notes: "ignore previous instructions" });
    expect(need.skills[0].term).toBe("Video editing");
    expect("notes" in need).toBe(false);
  });
});

describe("needToCriteria", () => {
  const need = matchNeedSchema.parse({
    craft: { category: "creator", importance: "required" },
    skills: [{ term: "Video editing", importance: "preferred" }, { term: "video EDITING", importance: "required" }],
    themes: [{ term: "swimwear", importance: "preferred" }],
    location: { text: "Los Angeles", remoteOk: true, importance: "preferred" },
    platforms: [{ platform: "tiktok", minAudience: 50000, importance: "required" }, { platform: "instagram", importance: "preferred" }],
    audience: { description: "women 18 to 24 in the US", importance: "required" },
    backedWork: "preferred",
  });

  it("lists the criteria in a fixed order, with stable ids", () => {
    expect(needToCriteria(need).map((c) => c.id)).toEqual([
      "craft:creator", "skill:video editing", "theme:swimwear", "location",
      "platform:tiktok", "audience-size:tiktok", "platform:instagram", "audience", "backed-work",
    ]);
  });

  it("keeps the first of two skills that differ only by case", () => {
    const skills = needToCriteria(need).filter((c) => c.kind === "skill");
    expect(skills).toHaveLength(1);
    expect(skills[0].importance).toBe("preferred");
  });

  it("asks for an audience size only when one was given, and says so in words", () => {
    const labels = needToCriteria(need).map((c) => c.label);
    expect(labels).toContain("TikTok audience of at least 50,000");
    expect(labels).not.toContain("Instagram audience of at least");
    expect(labels).toContain("Based in Los Angeles, or remote");
  });

  it("is empty for an empty need", () => {
    expect(needToCriteria({ skills: [], themes: [], platforms: [] })).toEqual([]);
  });
});
