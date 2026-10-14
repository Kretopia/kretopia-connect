import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PREMIUM_ENFORCED as CLIENT_ENFORCED } from "../premiumSwitch";
import {
  ABUSE_CEILING_DAILY_GENERATIONS,
  ABUSE_CEILING_DAILY_MESSAGES,
  PREMIUM_ENFORCED as SERVER_ENFORCED,
  dailyCapFor,
  effectiveIsPro,
} from "../../../supabase/functions/_shared/premiumSwitch";

describe("the Premium kick-off switch", () => {
  it("is off on both sides, and the two copies agree", () => {
    expect(CLIENT_ENFORCED).toBe(false);
    expect(SERVER_ENFORCED).toBe(false);
    expect(CLIENT_ENFORCED).toBe(SERVER_ENFORCED);
  });
});

describe("server: dailyCapFor", () => {
  it("while not enforced, lifts a free cap to the safety ceiling, never above what a tier already had", () => {
    expect(dailyCapFor(30, ABUSE_CEILING_DAILY_MESSAGES, false)).toBe(ABUSE_CEILING_DAILY_MESSAGES);
    expect(dailyCapFor(10, ABUSE_CEILING_DAILY_MESSAGES, false)).toBe(ABUSE_CEILING_DAILY_MESSAGES);
    expect(dailyCapFor(5, ABUSE_CEILING_DAILY_GENERATIONS, false)).toBe(ABUSE_CEILING_DAILY_GENERATIONS);
    expect(dailyCapFor(1000, ABUSE_CEILING_DAILY_MESSAGES, false)).toBe(1000);
  });

  it("keeps unlimited unlimited", () => {
    expect(dailyCapFor(-1, ABUSE_CEILING_DAILY_MESSAGES, false)).toBe(-1);
    expect(dailyCapFor(-1, ABUSE_CEILING_DAILY_MESSAGES, true)).toBe(-1);
  });

  it("once enforced, returns the tier's own cap unchanged", () => {
    expect(dailyCapFor(30, ABUSE_CEILING_DAILY_MESSAGES, true)).toBe(30);
    expect(dailyCapFor(5, ABUSE_CEILING_DAILY_GENERATIONS, true)).toBe(5);
  });

  it("is never unlimited for an account that was capped: the ceiling is finite", () => {
    expect(Number.isFinite(dailyCapFor(30, ABUSE_CEILING_DAILY_MESSAGES, false))).toBe(true);
  });

  it("effectiveIsPro is true for everyone only while not enforced", () => {
    expect(effectiveIsPro(false, false)).toBe(true);
    expect(effectiveIsPro(false, true)).toBe(false);
    expect(effectiveIsPro(true, true)).toBe(true);
  });
});

describe("client: gates answer yes while Premium is not enforced", () => {
  it("every account has Pro and Creator Pro access", async () => {
    const { hasProAccess, hasCreatorProAccess } = await import("../subscriptionConfig");
    expect(hasProAccess("free")).toBe(true);
    expect(hasCreatorProAccess("free")).toBe(true);
  });

  it("no monthly cap on any feature", async () => {
    const { getMonthlyCapForFeature, FREE_TIER_MONTHLY_CAPS } = await import("../subscriptionLimits");
    for (const feature of Object.keys(FREE_TIER_MONTHLY_CAPS) as Array<keyof typeof FREE_TIER_MONTHLY_CAPS>) {
      expect(getMonthlyCapForFeature(feature, "free")).toBe(-1);
    }
  });

  it("a free account has the top tier's limits: swipes, portfolio, advanced profile", async () => {
    const { getTierLimits, canAddPortfolioItem, getRemainingSwipes, canPerformAction } = await import("../subscriptionLimits");
    expect(getTierLimits("free")).toEqual(getTierLimits("creator_pro"));
    expect(getTierLimits("free", "company")).toEqual(getTierLimits("creator_pro", "company"));
    expect(canAddPortfolioItem("free", 500)).toBe(true);
    expect(getRemainingSwipes("free", 9999)).toBe(-1);
    expect(canPerformAction("free", "hasAdvancedProfile")).toBe(true);
    expect(canPerformAction("free", "canUndoSwipe")).toBe(true);
  });
});

describe("client: once enforced, the paid tiers matter again", () => {
  afterEach(() => {
    vi.doUnmock("../premiumSwitch");
    vi.resetModules();
  });

  it("a free account is limited and a pro account is not", async () => {
    vi.resetModules();
    vi.doMock("../premiumSwitch", () => ({ PREMIUM_ENFORCED: true }));
    const config = await import("../subscriptionConfig");
    const limits = await import("../subscriptionLimits");
    expect(config.hasProAccess("free")).toBe(false);
    expect(config.hasProAccess("pro")).toBe(true);
    expect(limits.getMonthlyCapForFeature("browseProfiles", "free")).toBe(limits.FREE_TIER_MONTHLY_CAPS.browseProfiles);
    expect(limits.canAddPortfolioItem("free", 500)).toBe(false);
    expect(limits.getRemainingSwipes("free", 20)).toBe(0);
  });
});

describe("server wiring: the five cap sites use the switch", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("desk-ai, desk-agent and thrive-ai-chat take their daily cap through dailyCapFor", () => {
    for (const fn of ["desk-ai", "desk-agent", "thrive-ai-chat"]) {
      const source = read(`${fn}/index.ts`);
      expect(source).toContain("dailyCapFor(");
      expect(source).toContain('from "../_shared/premiumSwitch.ts"');
    }
    expect(read("desk-ai/index.ts")).not.toContain("const dailyCap = isPro ? -1 : FREE_DAILY_LIMIT;");
    expect(read("desk-agent/index.ts")).not.toContain("const dailyCap = is_pro ? -1 : FREE_DAILY_LIMIT;");
    expect(read("thrive-ai-chat/index.ts")).not.toContain("const dailyCap = TIER_DAILY_CAPS[tier] ?? 20;");
  });

  it("the voice turn no longer refuses a free account on the daily cap", () => {
    const source = read("thrive-voice-turn/index.ts");
    expect(source).toContain("PREMIUM_ENFORCED && gate && (gate as { ok?: boolean }).ok === false");
    expect(source).toContain('rpc("consume_voice_seconds"');
  });

  it("the studio AI gate and scout-gigs use it too", () => {
    expect(read("_shared/studioAIGate.ts")).toContain("dailyCapFor(isPro ? -1 : FREE_DAILY_CAP, ABUSE_CEILING_DAILY_GENERATIONS)");
    expect(read("scout-gigs/index.ts")).toContain('const isFree = PREMIUM_ENFORCED && (tier === "free"');
  });

  it("an upgrade prompt is no longer the message of a safety ceiling", () => {
    expect(read("thrive-ai-chat/index.ts")).not.toContain("Upgrade your plan or come back tomorrow");
    expect(read("_shared/studioAIGate.ts")).not.toContain("Upgrade to Pro for unlimited, or come back tomorrow");
  });
});
