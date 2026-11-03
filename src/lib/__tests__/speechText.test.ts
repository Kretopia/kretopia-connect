import { describe, expect, it } from "vitest";
import { splitSpeech, toSpeech } from "@/lib/speechText";

describe("toSpeech: nothing is read literally", () => {
  it("drops markdown markers and keeps the words", () => {
    expect(toSpeech("**Great** news: your *Passport* is `ready`.")).toBe("Great news: your Passport is ready.");
    expect(toSpeech("## Next steps\nPick a project.")).toBe("Next steps. Pick a project.");
  });

  it("turns lists into sentences with a pause after each item", () => {
    expect(toSpeech("You could:\n- add a credit\n- invite a friend\n1. open Scout")).toBe("You could: add a credit. invite a friend. open Scout.");
  });

  it("never spells out a link: the label is said, a bare address becomes 'a link'", () => {
    expect(toSpeech("Read [the guide](https://kretopia.com/guide?x=1&y=2) first.")).toBe("Read the guide first.");
    expect(toSpeech("See https://www.kretopia.com/ada/passport for more.")).toBe("See a link for more.");
    expect(toSpeech("Go to www.kretopia.com now")).toBe("Go to a link now.");
  });

  it("does not read an email address or an id out", () => {
    expect(toSpeech("Write to ada.okoye+work@example.co.uk today.")).toBe("Write to an email address today.");
    expect(toSpeech("Project 3f2b8c1e-9a4d-4e7b-8c11-2f5d6a7b8c9d is active.")).toBe("Project is active.");
  });

  it("removes emoji and the joiners that carry them", () => {
    expect(toSpeech("Done 🎉 see you there 👩🏽‍🎤!")).toBe("Done see you there!");
  });

  it("drops code blocks and the agent's own action tags", () => {
    expect(toSpeech("Here you go.\n```js\nconst a = 1;\n```\nAll set.")).toBe("Here you go. All set.");
    expect(toSpeech('I will do it. <action type="create_task">{"title":"x"}</action> Done.')).toBe("I will do it. Done.");
  });

  it("reads a table row as a phrase, not as pipes", () => {
    expect(toSpeech("| Name | Rate |\n|---|---|\n| Ada | 300 |")).toBe("Name, Rate. Ada, 300.");
  });
});

describe("toSpeech: numbers the way a person says them", () => {
  it.each([
    ["It costs $1,200.", "It costs 1,200 dollars."],
    ["Budget $1,200–$2,000 per project", "Budget 1,200 to 2,000 dollars per project."],
    ["Pay is €300/day", "Pay is 300 euros a day."],
    ["Rate £45/hr", "Rate 45 pounds an hour."],
    ["Salary $128K", "Salary 128 thousand dollars."],
    ["A $1 fee", "A 1 dollar fee."],
    ["Fit is 45%", "Fit is 45 percent."],
    ["Open 2–4 weeks", "Open 2 to 4 weeks."],
    ["Due 2025-11-03", "Due 3 November 2025."],
  ])("%s", (input, expected) => expect(toSpeech(input)).toBe(expected));

  it("leaves a chain of numbers that is not a range, or a date that is not one, alone", () => {
    expect(toSpeech("Code 2025-13-45")).toBe("Code 2025-13-45.");
    expect(toSpeech("Call 555-1234-99")).toBe("Call 555-1234-99.");
  });
});

describe("toSpeech: abbreviations, symbols and pauses", () => {
  it("expands what a voice would stumble on", () => {
    expect(toSpeech("Use a mic, e.g. a USB one, vs. a headset etc.")).toBe("Use a mic, for example, a USB one, versus a headset and so on.");
    expect(toSpeech("Design & build, w/ a team, and/or alone")).toBe("Design and build, with a team, and or alone.");
  });

  it("turns long dashes into commas and collapses runs of punctuation", () => {
    expect(toSpeech("Ready — almost... really!!!")).toBe("Ready, almost… really!");
  });

  it("always ends on a stop, never leaves a dangling space or double comma", () => {
    expect(toSpeech("  hello   world  ")).toBe("hello world.");
    expect(toSpeech("a , , b")).toBe("a, b.");
  });

  it("is empty for nothing to say", () => {
    expect(toSpeech("")).toBe("");
    expect(toSpeech("   ")).toBe("");
    expect(toSpeech("```\ncode only\n```")).toBe("");
    expect(toSpeech(undefined as never)).toBe("");
  });
});

describe("splitSpeech", () => {
  it("keeps a short reply in one piece", () => {
    expect(splitSpeech("Hello there. How are you?")).toEqual(["Hello there. How are you?"]);
  });

  it("cuts only at sentence ends, and no piece passes the limit", () => {
    const text = Array.from({ length: 30 }, (_, i) => `This is sentence number ${i + 1} of the reply.`).join(" ");
    const pieces = splitSpeech(text, 200, 120);
    expect(pieces.length).toBeGreaterThan(3);
    for (const piece of pieces) {
      expect(piece.length).toBeLessThanOrEqual(200);
      expect(piece).toMatch(/[.!?]$/);
    }
    expect(pieces.join(" ")).toBe(text);
  });

  it("makes the first piece short so playback can begin sooner", () => {
    const text = Array.from({ length: 12 }, () => "A medium sentence that is about this long.").join(" ");
    const [first, second] = splitSpeech(text, 400, 100);
    expect(first.length).toBeLessThanOrEqual(100);
    expect(second.length).toBeGreaterThan(first.length);
  });

  it("breaks one very long sentence at its commas, then at spaces, and loses no word", () => {
    const long = `${Array.from({ length: 40 }, (_, i) => `clause number ${i}`).join(", ")}.`;
    const pieces = splitSpeech(long, 120, 120);
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(120);
    expect(pieces.join(" ").replace(/\s+/g, " ")).toBe(long);
    const noSpaces = splitSpeech(`${"word ".repeat(100).trim()}.`, 80, 80);
    for (const piece of noSpaces) expect(piece.length).toBeLessThanOrEqual(80);
  });

  it("handles quotes after a stop and a missing final stop", () => {
    expect(splitSpeech('She said "go." Then left')).toEqual(['She said "go." Then left']);
  });

  it("returns nothing for nothing", () => {
    expect(splitSpeech("")).toEqual([]);
    expect(splitSpeech("   ")).toEqual([]);
  });

  it("does not use look-behind, which older Safari cannot parse", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(`${process.cwd()}/src/lib/speechText.ts`, "utf8");
    expect(source).not.toMatch(/\(\?<[=!]/);
  });
});
