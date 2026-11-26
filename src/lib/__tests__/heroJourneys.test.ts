import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  HERO_JOURNEYS,
  HERO_PROMPTS,
  HERO_PROMPT_INTERVAL_MS,
  HERO_SECONDARY_CTAS,
  nextPromptIndex,
} from "../heroJourneys";
import { SCOUT_PATH } from "../opportunityRoutes";

const app = readFileSync("src/App.tsx", "utf8");
const pathOf = (to: string) => to.split("?")[0];

describe("hero journeys", () => {
  it("are People, Skills and Opportunities, in that order", () => {
    expect(HERO_JOURNEYS.map((j) => j.label)).toEqual(["People", "Skills", "Opportunities"]);
    expect(HERO_JOURNEYS.map((j) => j.feature)).toEqual(["Passport", "Match", "Scout"]);
  });

  it("each carries a one-line description and a distinct logo-gradient accent", () => {
    for (const j of HERO_JOURNEYS) expect(j.description.trim().length).toBeGreaterThan(10);
    expect(new Set(HERO_JOURNEYS.map((j) => j.accent)).size).toBe(HERO_JOURNEYS.length);
    expect(HERO_JOURNEYS.map((j) => j.accent)).toEqual(["--k-g-2", "--k-g-3", "--k-g-4"]);
  });

  it("only point at routes the app already has", () => {
    for (const target of [...HERO_JOURNEYS, ...HERO_SECONDARY_CTAS]) {
      // Scout's path is the shared constant, everything else is written out.
      const declared = pathOf(target.to) === SCOUT_PATH ? "path={SCOUT_PATH}" : `path="${pathOf(target.to)}"`;
      expect(app, `${target.to} must be a route in App.tsx`).toContain(declared);
    }
  });

  it("People and Skills open different places: the Grid, and Match", () => {
    const [people, skills] = HERO_JOURNEYS;
    expect(people.to).toBe("/match?tab=browse&view=grid");
    expect(skills.to).toBe("/match");
  });

  it("the secondary actions are the navbar's own destinations", () => {
    const nav = readFileSync("src/components/Navbar.tsx", "utf8");
    for (const cta of HERO_SECONDARY_CTAS.filter((c) => c.label !== "Explore Kretopia")) {
      expect(nav).toContain(`path: "${cta.to}", label: "${cta.label}"`);
    }
    expect(nav).toContain('path: "/discover"');
  });

  it("have a distinct analytics id each", () => {
    const ids = [...HERO_JOURNEYS, ...HERO_SECONDARY_CTAS].map((c) => c.analyticsId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("hero example searches", () => {
  it("are the six requested, each with the words to search", () => {
    expect(HERO_PROMPTS.map((p) => p.label)).toEqual([
      "Find a film editor",
      "Find a tattoo artist",
      "Find a music producer",
      "Find a creative team",
      "Find opportunities for photographers",
      "Find people behind a project",
    ]);
    for (const p of HERO_PROMPTS) expect(p.query.trim().length).toBeGreaterThanOrEqual(3);
  });

  it("move on in order and wrap round", () => {
    expect(nextPromptIndex(0, 6)).toBe(1);
    expect(nextPromptIndex(5, 6)).toBe(0);
    expect(nextPromptIndex(0, 0)).toBe(0);
  });

  it("stay long enough to read", () => {
    expect(HERO_PROMPT_INTERVAL_MS).toBeGreaterThanOrEqual(3000);
  });
});
