// Guards for Kreto's surfaces: semantic tokens only (they follow Daylight and Midnight), no blur on sticky or fixed
// surfaces, and no "AI", "assistant", "chatbot" or "copilot" wording or internal names in what people read. Plus the
// recorded-outcome labels the /kreto page shows for recent actions.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recordedOutcome } from "../kretoActionOutcome";

const ROOT = path.resolve(__dirname, "../../..");
const FILES = [
  ...readdirSync(path.join(ROOT, "src/components/kreto")).filter((f) => f.endsWith(".tsx")).map((f) => `src/components/kreto/${f}`),
  "src/pages/KretoTab.tsx",
  "src/components/agent/AgentApprovalCard.tsx",
];
const source = (f: string) => readFileSync(path.join(ROOT, f), "utf8");

describe("Kreto surfaces use the design system", () => {
  it("no hard-coded white, black or hex colours in classes", () => {
    for (const f of FILES) {
      const hits = source(f).match(/\b(?:text|bg|border|ring|placeholder|from|to|via)-(?:white|black)\b|\b(?:text|bg|border)-\[#[0-9a-f]{3,8}\]/gi) ?? [];
      expect([f, hits]).toEqual([f, []]);
    }
  });

  it("no blur on a sticky or fixed surface", () => {
    for (const f of FILES) {
      for (const line of source(f).split("\n")) {
        if (/backdrop-blur/.test(line)) expect([f, line.trim()]).not.toEqual([f, expect.stringMatching(/\b(sticky|fixed)\b/)]);
      }
    }
  });
});

describe("Kreto speaks as Kreto", () => {
  // String literals and JSX text people read (imports, identifiers and comments are not shown to anyone).
  const visibleText = (src: string) =>
    src
      .split("\n")
      .filter((l) => !/^\s*(import|export \{|\/\/|\*|\/\*)/.test(l))
      .join("\n")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .match(/"[^"\n]*"|`[^`\n]*`|>[^<>{}\n]+</g) ?? [];

  it("no AI, assistant, chatbot or copilot wording, and no internal names, in what people read", () => {
    for (const f of FILES) {
      // Not shown to anyone: `"assistant"` alone (a message role in code), and identifiers such as route paths and event
      // names (no spaces, with a slash, colon or hyphen). A bare word like "Copilot" is still caught.
      const identifier = (t: string) => t === '"assistant"' || /^["`][\w.@]*[/:-][\w/:.@-]*["`]$/.test(t);
      const bad = visibleText(source(f)).filter((t) => !identifier(t) && /\bAI\b|\bassistant\b|chatbot|\bcopilot\b|thrive|backend|gemini|openai/i.test(t));
      expect([f, bad]).toEqual([f, []]);
    }
  });
});

describe("recent actions say what was recorded", () => {
  it("done, didn't go through, not confirmed, a policy block, and nothing yet", () => {
    expect(recordedOutcome("executed", null)).toEqual({ label: "Done", blocked: false });
    expect(recordedOutcome("auto_executed", {})).toEqual({ label: "Done", blocked: false });
    expect(recordedOutcome("failed", { outcome: "failed" })).toEqual({ label: "Didn't go through", blocked: false });
    expect(recordedOutcome("failed", { outcome: "unknown" })).toEqual({ label: "Not confirmed", blocked: false });
    expect(recordedOutcome("failed", null)).toEqual({ label: "Didn't go through", blocked: false });
    expect(recordedOutcome("rejected", { outcome: "blocked" })).toEqual({ label: null, blocked: true });
    expect(recordedOutcome("rejected", null)).toEqual({ label: null, blocked: false });
    expect(recordedOutcome("proposed", null)).toEqual({ label: null, blocked: false });
  });
});
