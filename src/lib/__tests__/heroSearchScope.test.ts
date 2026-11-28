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
  it("a generic query opens the Search Page, narrowed to the topic, with the words", () => {
    expect(scopeSearchTarget("all", "photographer")).toBe("/search?q=photographer");
    expect(scopeSearchTarget("people", "photographer")).toBe("/search?q=photographer&scope=people");
    expect(scopeSearchTarget("scout", "photographer")).toBe("/search?q=photographer&scope=scout");
    expect(scopeSearchTarget("match", "motion design")).toBe("/search?q=motion%20design&scope=match");
  });

  it("Events and SoundStages are not families of the Search Page: they open their own pages", () => {
    expect(scopeSearchTarget("events", "electronic music")).toBe("/meetup?q=electronic%20music");
    expect(scopeSearchTarget("soundstages", "electronic music")).toBe("/soundstages?q=electronic%20music");
  });

  it("trims the words and encodes what would break a URL", () => {
    expect(scopeSearchTarget("scout", "  a&b=c  ")).toBe("/search?q=a%26b%3Dc&scope=scout");
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
    expect(scopeSources("all")).toEqual({ people: true, skills: true, opportunities: true, events: true, work: true, stages: false });
    expect(scopeSources("people")).toEqual({ people: true, skills: false, opportunities: false, events: false, work: false, stages: false });
    expect(scopeSources("scout")).toMatchObject({ opportunities: true, people: false, events: false });
    expect(scopeSources("match")).toMatchObject({ skills: true, people: false });
    expect(scopeSources("events")).toMatchObject({ events: true, people: false, opportunities: false });
    expect(scopeSources("soundstages")).toMatchObject({ stages: true, people: false, events: false });
  });
});
