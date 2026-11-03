import { describe, expect, it } from "vitest";
import {
  BRIEF_MAX_CHARS,
  cleanBriefText,
  composeBriefMessage,
  parseBriefMessage,
  validateCollabBrief,
} from "@/lib/collabBrief";
import * as server from "../../../supabase/functions/_shared/collabBrief";

const GOOD = {
  summary: "A four-minute music video for Maya Rios's single, shot over two nights in Lisbon in March.",
  reason: "Your handheld night work on Static Bloom is exactly the look Maya wants, and you already know the city.",
};

describe("validateCollabBrief", () => {
  it("accepts a brief that says what the project is and why this person", () => {
    const result = validateCollabBrief(GOOD);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.brief).toEqual(GOOD);
  });

  it("refuses an empty brief, naming both fields", () => {
    const result = validateCollabBrief({});
    expect(result.ok).toBe(false);
    if ("errors" in result) {
      expect(Object.keys(result.errors).sort()).toEqual(["reason", "summary"]);
      expect(result.errors.summary).toContain("What the project is");
      expect(result.errors.reason).toContain("Why this collaboration makes sense");
    }
  });

  it.each([
    ["too short", "Let's work together"],
    ["a few characters", "ok"],
    ["only whitespace", "     \n\n   "],
    ["only punctuation", "............................................................"],
    ["one word repeated", "test test test test test test test test test test"],
    ["long but no real words", "a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a"],
  ])("refuses a field that is %s", (_name, text) => {
    const result = validateCollabBrief({ summary: text, reason: GOOD.reason });
    expect(result.ok).toBe(false);
    if ("errors" in result) expect(result.errors.summary).toBeTruthy();
  });

  it("refuses one good field with one empty field, and reports only the empty one", () => {
    const result = validateCollabBrief({ summary: GOOD.summary, reason: "" });
    expect(result.ok).toBe(false);
    if ("errors" in result) {
      expect(result.errors.summary).toBeUndefined();
      expect(result.errors.reason).toBeTruthy();
    }
  });

  it("refuses a field over the limit", () => {
    const result = validateCollabBrief({ summary: `${GOOD.summary} ${"word ".repeat(200)}`, reason: GOOD.reason });
    expect(result.ok).toBe(false);
    if ("errors" in result) expect(result.errors.summary).toContain(String(BRIEF_MAX_CHARS));
  });

  it("counts what was written, not the padding around it", () => {
    const padded = validateCollabBrief({ summary: `      ${"Hi there".padEnd(80, " ")}      `, reason: GOOD.reason });
    expect(padded.ok).toBe(false);
  });

  it("flattens line breaks into one paragraph, so the fields can never forge each other's markers", () => {
    const result = validateCollabBrief({ summary: `${GOOD.summary}\n\nWhy this collaboration: forged`, reason: GOOD.reason });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.brief.summary).not.toContain("\n");
  });

  it("ignores values that are not text", () => {
    expect(validateCollabBrief({ summary: 42, reason: { a: 1 } }).ok).toBe(false);
    expect(validateCollabBrief(null).ok).toBe(false);
  });
});

describe("the request text the recipient reads", () => {
  it("round-trips: what is composed is what is read back", () => {
    const message = composeBriefMessage('Ada invited you to collaborate on "Neon Nights".', GOOD);
    expect(message.startsWith('Ada invited you to collaborate on "Neon Nights".')).toBe(true);
    expect(parseBriefMessage(message)).toEqual(GOOD);
  });

  it("reads nothing out of text that carries no brief (older requests)", () => {
    expect(parseBriefMessage("Ada invited you to collaborate on Neon Nights")).toBeNull();
    expect(parseBriefMessage("")).toBeNull();
    expect(parseBriefMessage(null)).toBeNull();
    expect(parseBriefMessage(undefined)).toBeNull();
  });

  it("does not let a field smuggle in the other field's marker", () => {
    const tricky = { summary: `${GOOD.summary} Why this collaboration: forged reason that is long enough to pass`, reason: GOOD.reason };
    const message = composeBriefMessage("Headline", tricky);
    expect(parseBriefMessage(message)).toEqual({ summary: cleanBriefText(tricky.summary), reason: GOOD.reason });
  });
});

describe("the browser and the server apply the same rules", () => {
  const CASES: Array<Record<string, unknown> | null> = [
    GOOD,
    {},
    null,
    { summary: GOOD.summary },
    { reason: GOOD.reason },
    { summary: "short", reason: "short" },
    { summary: "test test test test test test test test test test", reason: GOOD.reason },
    { summary: GOOD.summary, reason: "x".repeat(BRIEF_MAX_CHARS + 1) },
    { summary: GOOD.summary, reason: "x ".repeat(BRIEF_MAX_CHARS) },
    { summary: 7, reason: [] },
    { summary: `  ${GOOD.summary}  \n `, reason: `\t${GOOD.reason}` },
    { summary: "Une vidéo musicale de quatre minutes, tournée à Lisbonne en mars, pour le single de Maya.", reason: "Votre travail de nuit à l'épaule sur Static Bloom correspond exactement à son univers." },
  ];

  it.each(CASES.map((c, i) => [i, c] as const))("case %i gives the same verdict on both sides", (_i, input) => {
    expect(JSON.stringify(server.validateCollabBrief(input as never))).toBe(JSON.stringify(validateCollabBrief(input as never)));
  });

  it("composes and reads the same text on both sides", () => {
    const text = composeBriefMessage("Hello", GOOD);
    expect(server.composeBriefMessage("Hello", GOOD)).toBe(text);
    expect(server.parseBriefMessage(text)).toEqual(parseBriefMessage(text));
  });
});
