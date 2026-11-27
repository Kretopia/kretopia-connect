import { describe, expect, it } from "vitest";

import { broaderQuery, countResults, familyFromScope, familySources, scopeParamFor, SEARCH_FAMILIES, searchPageHref } from "../searchPageModel";

describe("the Search Page's families", () => {
  it("are All, Opportunities, People, Roles & skills, Work and Events, in that order", () => {
    expect(SEARCH_FAMILIES.map((f) => f.label)).toEqual(["All", "Opportunities", "People", "Roles & skills", "Work", "Events"]);
  });

  it("take the hero's topics through ?scope= (Scout is Opportunities, Match is Roles & skills)", () => {
    expect(familyFromScope("scout")).toBe("opportunities");
    expect(familyFromScope("people")).toBe("people");
    expect(familyFromScope("match")).toBe("roles");
    expect(familyFromScope("work")).toBe("work");
    expect(familyFromScope("events")).toBe("events");
    expect(familyFromScope("all")).toBe("all");
  });

  it("fall back to All for anything unknown or missing", () => {
    expect(familyFromScope(null)).toBe("all");
    expect(familyFromScope("soundstages")).toBe("all");
    expect(familyFromScope("<script>")).toBe("all");
  });

  it("round-trips: a family's own parameter selects it", () => {
    for (const f of SEARCH_FAMILIES) expect(familyFromScope(scopeParamFor(f.id))).toBe(f.id);
  });

  it("asks only the public reads of the family; All asks them all", () => {
    expect(familySources("all")).toEqual({ people: true, opportunities: true, work: true, events: true, roles: true });
    expect(familySources("people")).toEqual({ people: true, opportunities: false, work: false, events: false, roles: false });
    expect(familySources("opportunities")).toMatchObject({ opportunities: true, people: false });
    expect(familySources("roles")).toMatchObject({ roles: true, people: false, opportunities: false });
    expect(familySources("work")).toMatchObject({ work: true, events: false });
  });
});

describe("the Search Page's address", () => {
  it("carries the words and the family, and keeps All implicit", () => {
    expect(searchPageHref("graphic designer")).toBe("/search?q=graphic+designer");
    expect(searchPageHref("graphic designer", "opportunities")).toBe("/search?q=graphic+designer&scope=scout");
    expect(searchPageHref("", "roles")).toBe("/search?scope=match");
    expect(searchPageHref("  ")).toBe("/search");
  });
});

describe("broadening a search", () => {
  it("drops the last word when something is left to search", () => {
    expect(broaderQuery("Editorial Motion Designer Penang")).toBe("Editorial Motion Designer");
    expect(broaderQuery("graphic designer")).toBe("graphic");
  });

  it("offers nothing for a single word or a sliver", () => {
    expect(broaderQuery("photographer")).toBeNull();
    expect(broaderQuery("  ")).toBeNull();
    expect(broaderQuery("a b")).toBeNull();
  });

  it("counts the rows across the groups", () => {
    expect(countResults({ people: [1, 2], opportunities: [1], work: [], events: [] })).toBe(3);
    expect(countResults({})).toBe(0);
  });
});
