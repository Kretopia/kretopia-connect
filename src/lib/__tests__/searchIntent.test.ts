import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEARCH_INTENT,
  EXPLORE_BY,
  SEARCH_INTENTS,
  exploreByCategory,
  exploreByTarget,
  searchExploreBy,
  searchIntentTarget,
} from "../searchIntent";

describe("search intents", () => {
  it("are People → Passport, Skills → Match, Opportunities → Scout, in that order", () => {
    expect(SEARCH_INTENTS.map((i) => [i.label, i.destination])).toEqual([
      ["People", "Passport"],
      ["Skills", "Match"],
      ["Opportunities", "Scout"],
    ]);
    expect(DEFAULT_SEARCH_INTENT).toBe("people");
  });

  it("each lands in its own feature with the words carried as ?q=", () => {
    expect(searchIntentTarget("people", "Ada Lovelace")).toBe("/match?tab=directory&q=Ada%20Lovelace");
    expect(searchIntentTarget("skills", "Motion Design")).toBe("/match?tab=directory&q=Motion%20Design");
    expect(searchIntentTarget("opportunities", "film editor")).toBe("/scout?q=film%20editor");
  });

  it("trims the words and encodes what could break a URL", () => {
    expect(searchIntentTarget("opportunities", "  R&D #1  ")).toBe("/scout?q=R%26D%20%231");
  });
});

describe("Skills → Explore by", () => {
  it("offers exactly the five ways in", () => {
    expect(EXPLORE_BY.map((c) => c.label)).toEqual([
      "Creative Disciplines",
      "Production & Crew",
      "Skills & Expertise",
      "Studios & Companies",
      "Music & Sound",
    ]);
  });

  it("gives every category enough to browse, with no duplicate label or empty term", () => {
    for (const category of EXPLORE_BY) {
      expect(category.items.length).toBeGreaterThanOrEqual(8);
      const labels = category.items.map((i) => i.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const entry of category.items) {
        expect(entry.term.trim()).not.toBe("");
        expect(entry.description.trim()).not.toBe("");
      }
    }
  });

  it("walks Skills → Creative Disciplines → Motion Design → the matching professionals in Match", () => {
    const motion = exploreByCategory("disciplines")?.items.find((i) => i.label === "Motion Design");
    expect(motion).toBeDefined();
    expect(exploreByTarget(motion!)).toBe("/match?tab=directory&q=Motion");
  });

  it("finds an item from the first letters, best match first, across categories", () => {
    const hits = searchExploreBy("motion");
    expect(hits[0]?.item.label).toBe("Motion Design");
    expect(hits[0]?.category.id).toBe("disciplines");
    expect(searchExploreBy("m").length).toBeGreaterThan(3);
    expect(searchExploreBy("  ")).toEqual([]);
    expect(searchExploreBy("zzzzqx")).toEqual([]);
  });

  it("ignores accents and case", () => {
    expect(searchExploreBy("MOTION")[0]?.item.label).toBe("Motion Design");
    expect(searchExploreBy("Cinématograph").map((h) => h.item.label)).toContain("Cinematographers");
    expect(searchExploreBy("photo").map((h) => h.item.label)).toContain("Photography");
  });
});
