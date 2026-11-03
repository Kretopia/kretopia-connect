import { describe, expect, it } from "vitest";
import { allowanceFrom, blockedExplanation, describeReset, formatWait, nextResetAt } from "@/lib/aiAllowance";
import type { AiCreditOverview } from "@/lib/thriveCopilot";

const NOW = new Date("2026-11-03T18:48:00Z"); // 5 h 12 min before the next 00:00 UTC

const overview = (over: { messages?: Partial<AiCreditOverview["mine"][number]> | null; tokens?: Partial<AiCreditOverview["mine"][number]> | null; env?: Partial<AiCreditOverview["envelope"]> } = {}): AiCreditOverview => ({
  envelope: { day: "2026-11-03", credits_used: 40, credits_cap: 1000, credits_reserved: 0, denials_allowance: 0, denials_budget: 0, ...over.env },
  features: [],
  mine: [
    ...(over.messages === null ? [] : [{ feature: "kreto_message", used: 5, cap: 20, reserved: 0, ...over.messages }]),
    ...(over.tokens === null ? [] : [{ feature: "kreto_tokens", used: 12000, cap: 60000, reserved: 0, ...over.tokens }]),
  ],
});

describe("the allowance, from the server's numbers", () => {
  it("counts what is left of messages and tokens, reserved included", () => {
    const a = allowanceFrom(overview({ messages: { used: 5, reserved: 2 } }), NOW)!;
    expect(a.messages).toEqual({ used: 5, reserved: 2, cap: 20, left: 13 });
    expect(a.tokens?.left).toBe(48000);
    expect(a.ceiling).toEqual({ left: 960, cap: 1000, pct: 96 });
    expect(a.blocked).toBeNull();
  });

  it("is blocked when the messages are used up, or the tokens, and never counts below zero", () => {
    expect(allowanceFrom(overview({ messages: { used: 20 } }), NOW)!.blocked).toBe("allowance");
    expect(allowanceFrom(overview({ messages: { used: 19, reserved: 1 } }), NOW)!.blocked).toBe("allowance");
    expect(allowanceFrom(overview({ messages: { used: 25 } }), NOW)!.messages?.left).toBe(0);
    expect(allowanceFrom(overview({ tokens: { used: 60000 } }), NOW)!.blocked).toBe("allowance");
  });

  it("is blocked for everyone when the service's own ceiling is reached, and says it is the ceiling", () => {
    const a = allowanceFrom(overview({ env: { credits_used: 1000 } }), NOW)!;
    expect(a.blocked).toBe("ceiling");
    expect(blockedExplanation(a, NOW, "UTC")).toContain("whole service");
  });

  it("puts a personal limit before the shared one when both are reached", () => {
    expect(allowanceFrom(overview({ messages: { used: 20 }, env: { credits_used: 1000 } }), NOW)!.blocked).toBe("allowance");
  });

  it("has nothing to count for a feature the server sets no cap on, and is not blocked by it", () => {
    const a = allowanceFrom(overview({ messages: { cap: -1 }, tokens: null }), NOW)!;
    expect(a.messages).toBeNull();
    expect(a.tokens).toBeNull();
    expect(a.blocked).toBeNull();
  });

  it("treats a cap of zero as blocked, and says nothing is included", () => {
    const a = allowanceFrom(overview({ messages: { cap: 0, used: 0 } }), NOW)!;
    expect(a.blocked).toBe("allowance");
    expect(blockedExplanation(a, NOW, "UTC")).toContain("not included");
  });

  it("gives nothing when the overview is missing or malformed", () => {
    expect(allowanceFrom(null, NOW)).toBeNull();
    expect(allowanceFrom(undefined, NOW)).toBeNull();
    expect(allowanceFrom({} as AiCreditOverview, NOW)).toBeNull();
  });

  it("resets at the next midnight UTC, following the server's own day", () => {
    expect(allowanceFrom(overview(), NOW)!.resetsAt.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(nextResetAt(NOW).toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });

  it("falls back to the next midnight when the server's day is stale or missing", () => {
    expect(allowanceFrom(overview({ env: { day: "2026-11-01" } }), NOW)!.resetsAt.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(allowanceFrom(overview({ env: { day: undefined as never } }), NOW)!.resetsAt.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(allowanceFrom(overview({ env: { day: "not a day" } }), NOW)!.resetsAt.toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });
});

describe("how long until it resets", () => {
  it.each([
    [30_000, "less than a minute"],
    [60_000, "1 min"],
    [12 * 60_000, "12 min"],
    [60 * 60_000, "1 h"],
    [(5 * 60 + 12) * 60_000, "5 h 12 min"],
    [(5 * 60 + 12) * 60_000 - 1, "5 h 12 min"],
    [23 * 3600_000 + 59 * 60_000, "23 h 59 min"],
  ])("%i ms is %s", (ms, text) => expect(formatWait(ms)).toBe(text));

  it("is shown on the person's own clock as well as in UTC", () => {
    const reset = describeReset(new Date("2026-11-04T00:00:00Z"), NOW, "UTC");
    expect(reset.wait).toBe("5 h 12 min");
    expect(reset.local).toMatch(/12:00/);
    expect(describeReset(new Date("2026-11-04T00:00:00Z"), NOW, "Europe/Paris").local).toMatch(/1:00/);
  });
});

describe("the explanation of a block", () => {
  it("says what was used and exactly when it resets", () => {
    const a = allowanceFrom(overview({ messages: { used: 20 } }), NOW)!;
    const text = blockedExplanation(a, NOW, "Europe/Paris");
    expect(text).toMatch(/^You've used today's 20 of 20 Kreto messages\./);
    expect(text).toContain("It resets at midnight UTC, in 5 h 12 min (");
    expect(text).toMatch(/1:00.*your time\)\.$/);
  });

  it("names the token allowance when that is what ran out", () => {
    const a = allowanceFrom(overview({ tokens: { used: 60000 } }), NOW)!;
    expect(blockedExplanation(a, NOW, "UTC")).toMatch(/^You've used today's Kreto allowance\./);
  });
});
