import { describe, expect, it } from "vitest";

import { HERO_PROMPTS, HERO_PROMPT_INTERVAL_MS, nextPromptIndex } from "../heroJourneys";

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
