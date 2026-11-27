import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEARCH_SCOPE,
  HERO_TOPICS,
  HERO_TOPIC_PLACEHOLDER,
  SEARCH_SCOPES,
  isSearchScope,
  scopePlaceholder,
  scopeSearchTarget,
  scopeSources,
  searchScopeMeta,
  type SearchScope,
} from "../heroSearchScope";
import { SCOUT_PATH } from "../opportunityRoutes";

const app = readFileSync("src/App.tsx", "utf8");
const pathOf = (to: string) => to.split("?")[0];
const none = { people: 0, skills: 0, opportunities: 0, events: 0 };

describe("hero search scopes", () => {
  it("are All (the default), People, Scout, Match, Events and SoundStages, in that order", () => {
    expect(SEARCH_SCOPES.map((s) => s.label)).toEqual(["All", "People", "Scout", "Match", "Events", "SoundStages"]);
    expect(DEFAULT_SEARCH_SCOPE).toBe("all");
    expect(SEARCH_SCOPES.map((s) => s.id)).toEqual(["all", "people", "scout", "match", "events", "soundstages"]);
  });

  it("each has a description and a placeholder in a full and a compact form", () => {
    for (const s of SEARCH_SCOPES) {
      expect(s.description.length).toBeGreaterThan(5);
      expect(scopePlaceholder(s.id, false)).toBe(s.placeholder);
      expect(scopePlaceholder(s.id, true)).toBe(s.placeholderCompact);
      expect(s.placeholderCompact.length).toBeLessThanOrEqual(s.placeholder.length);
    }
  });

  it("the hero shows four compact topics, in order, each one with a real destination", () => {
    expect(HERO_TOPICS.map((id) => searchScopeMeta(id).label)).toEqual(["All", "Scout", "People", "Match"]);
    expect(HERO_TOPIC_PLACEHOLDER).toBe("Search creatives, skills or opportunities…");
  });

  it("recognises its own ids and falls back to All for anything else", () => {
    expect(isSearchScope("events")).toBe(true);
    expect(isSearchScope("Events")).toBe(false);
    expect(isSearchScope(undefined)).toBe(false);
    expect(searchScopeMeta("nope" as SearchScope).id).toBe("all");
  });
});

describe("where a scoped search lands", () => {
  it("carries the words and opens the scope's own area", () => {
    expect(scopeSearchTarget("people", "photographer")).toBe("/match?tab=browse&view=grid&q=photographer");
    expect(scopeSearchTarget("match", "motion design")).toBe("/match?tab=browse&view=grid&q=motion%20design");
    expect(scopeSearchTarget("scout", "photographer")).toBe(`${SCOUT_PATH}?q=photographer`);
    expect(scopeSearchTarget("events", "electronic music")).toBe("/meetup?q=electronic%20music");
    expect(scopeSearchTarget("soundstages", "electronic music")).toBe("/soundstages?q=electronic%20music");
  });

  it("trims the words and encodes what would break a URL", () => {
    expect(scopeSearchTarget("scout", "  a&b=c  ")).toBe("/scout?q=a%26b%3Dc");
  });

  it("All opens the first area with an answer: people and skills, then Scout, then Events, else the Grid", () => {
    expect(scopeSearchTarget("all", "x", { ...none, people: 1, opportunities: 2 })).toContain("/match?");
    expect(scopeSearchTarget("all", "x", { ...none, skills: 1, events: 1 })).toContain("/match?");
    expect(scopeSearchTarget("all", "x", { ...none, opportunities: 1, events: 1 })).toBe("/scout?q=x");
    expect(scopeSearchTarget("all", "x", { ...none, events: 1 })).toBe("/meetup?q=x");
    expect(scopeSearchTarget("all", "x", none)).toBe("/match?tab=browse&view=grid&q=x");
    expect(scopeSearchTarget("all", "x")).toBe("/match?tab=browse&view=grid&q=x");
  });

  it("only points at routes the app already has", () => {
    for (const scope of SEARCH_SCOPES) {
      const target = scopeSearchTarget(scope.id, "x");
      const declared = pathOf(target) === SCOUT_PATH ? "path={SCOUT_PATH}" : `path="${pathOf(target)}"`;
      expect(app, `${target} must be a route in App.tsx`).toContain(declared);
    }
  });
});

describe("which sources a scope asks while someone types", () => {
  it("All asks everything that can be answered at once; a chosen scope asks only its own", () => {
    expect(scopeSources("all")).toEqual({ people: true, skills: true, opportunities: true, events: true, stages: false });
    expect(scopeSources("people")).toEqual({ people: true, skills: false, opportunities: false, events: false, stages: false });
    expect(scopeSources("scout")).toMatchObject({ opportunities: true, people: false, events: false });
    expect(scopeSources("match")).toMatchObject({ skills: true, people: false });
    expect(scopeSources("events")).toMatchObject({ events: true, people: false, opportunities: false });
    expect(scopeSources("soundstages")).toMatchObject({ stages: true, people: false, events: false });
  });
});
