import {
  EXPLORE_BY,
  HERO_SEARCH_PLACEHOLDER,
  SEARCH_INTENTS,
  exploreByCategory,
  exploreByTarget,
  searchEnterTarget,
  searchExploreBy,
  searchIntentTarget,
} from "../searchIntent";

describe("search sections", () => {
  it("are People → Passport, Skills → Match, Opportunities → Scout, in that order, each with a caption", () => {
    expect(SEARCH_INTENTS.map((i) => [i.label, i.destination])).toEqual([
      ["People", "Passport"],
      ["Skills", "Match"],
      ["Opportunities", "Scout"],
    ]);
    for (const section of SEARCH_INTENTS) expect(section.caption.trim()).not.toBe("");
  });

  it("the field says what it finds before anything is typed", () => {
    expect(HERO_SEARCH_PLACEHOLDER).toBe("Search people, skills and opportunities");
  });

  it("People and Skills land on Match's Grid, Opportunities on Scout, with the words carried as ?q=", () => {
    expect(searchIntentTarget("people", "Ada Lovelace")).toBe("/match?tab=browse&view=grid&q=Ada%20Lovelace");
    expect(searchIntentTarget("skills", "Motion Design")).toBe("/match?tab=browse&view=grid&q=Motion%20Design");
    expect(searchIntentTarget("opportunities", "film editor")).toBe("/scout?q=film%20editor");
  });

  it("trims the words and encodes what could break a URL", () => {
    expect(searchIntentTarget("opportunities", "  R&D #1  ")).toBe("/scout?q=R%26D%20%231");
  });

  it("Enter goes to the Grid, except when the only answer is an open opportunity", () => {
    expect(searchEnterTarget("ada", { people: 3, skills: 0, opportunities: 0 })).toBe("/match?tab=browse&view=grid&q=ada");
    expect(searchEnterTarget("motion", { people: 0, skills: 2, opportunities: 1 })).toBe("/match?tab=browse&view=grid&q=motion");
    expect(searchEnterTarget("editor", { people: 1, skills: 0, opportunities: 2 })).toBe("/match?tab=browse&view=grid&q=editor");
    expect(searchEnterTarget("hiring", { people: 0, skills: 0, opportunities: 2 })).toBe("/scout?q=hiring");
    expect(searchEnterTarget("zzz", { people: 0, skills: 0, opportunities: 0 })).toBe("/match?tab=browse&view=grid&q=zzz");
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

  it("walks Skills → Creative Disciplines → Motion Design → the Grid in Match, with the term in its search bar", () => {
    const motion = exploreByCategory("disciplines")?.items.find((i) => i.label === "Motion Design");
    expect(motion).toBeDefined();
    expect(exploreByTarget(motion!)).toBe("/match?tab=browse&view=grid&q=Motion");
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
