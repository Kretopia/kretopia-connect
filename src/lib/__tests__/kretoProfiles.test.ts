import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIRM_SHARE,
  EFFORT_LABEL,
  KRETO_PROFILE_IDS,
  KRETO_PROFILES,
  PRO_TIER_ENABLED,
  TIER_MODEL,
  WEEKLY_CREDIT_ALLOWANCE,
  autoProfile,
  estimateCredits,
  guardKretoRequest,
  kretoProfileName,
  resolveKretoRoute,
  sharePct,
  weekStartUtc,
  type KretoEffort,
  type KretoTier,
  type RouteResult,
} from "../../../supabase/functions/_shared/kretoProfiles";

const RANK: Record<KretoTier, number> = { lite: 0, fast: 1, strong: 2, pro: 3 };
// The app's tsconfig is not strict, so `ok` does not narrow the result: these helpers do it explicitly.
type Refusal = Extract<RouteResult, { ok: false }>;
const route = (input: Parameters<typeof resolveKretoRoute>[0]) => {
  const r = resolveKretoRoute(input);
  if (!r.ok) throw new Error(`expected a route, got ${(r as Refusal).code}`);
  return r.route;
};
const refusal = (input: Parameters<typeof resolveKretoRoute>[0]): Refusal => {
  const r = resolveKretoRoute(input);
  if (r.ok) throw new Error(`expected a refusal, got ${r.route.profile}`);
  return r as Refusal;
};
const PAID = { paidPlan: true } as const;
const PROVIDER_WORDS = /gemini|google|openai|gpt|anthropic|claude|llama|mistral/i;

describe("Kreto models: branded routes, never provider names", () => {
  it("has the ten profiles, each named Kreto <Name>, each with a tier for every effort", () => {
    expect(KRETO_PROFILE_IDS).toHaveLength(10);
    for (const id of KRETO_PROFILE_IDS) {
      expect(kretoProfileName(id)).toMatch(/^Kreto [A-Z][a-z]+$/);
      for (const e of [1, 2, 3, 4] as KretoEffort[]) expect(KRETO_PROFILES[id].tiers[e]).toBeDefined();
      expect(KRETO_PROFILES[id].focus).not.toMatch(PROVIDER_WORDS);
    }
    expect(Object.values(EFFORT_LABEL)).toEqual(["Quick", "Balanced", "Deep", "Maximum"]);
  });

  it("keeps the provider mapping on the server: every tier maps to a configured model id", () => {
    for (const tier of ["lite", "fast", "strong", "pro"] as KretoTier[]) expect(TIER_MODEL[tier]).toMatch(/\S/);
  });

  it("refusal and notice text never names a provider", () => {
    expect(refusal({ requested: "oracle", text: "x", paidPlan: true }).message).not.toMatch(PROVIDER_WORDS);
    const noticed = route({ requested: "vision", effort: 4, text: "x", ...PAID });
    expect(noticed.notice ?? "").not.toMatch(PROVIDER_WORDS);
  });
});

describe("explicit choice wins", () => {
  it("uses the chosen profile's tier at the chosen effort", () => {
    expect(route({ requested: "signal", effort: 1, text: "hi", ...PAID })).toMatchObject({ profile: "signal", auto: false, tier: "lite", outputTokens: 300, historyMessages: 16 });
    expect(route({ requested: "pulse", effort: 3, text: "hi", ...PAID })).toMatchObject({ profile: "pulse", tier: "strong", outputTokens: 1200 });
    expect(route({ requested: "vision", effort: 1, text: "hi", ...PAID })).toMatchObject({ profile: "vision", tier: "strong", outputTokens: 300 });
  });

  it("an explicit pick is never replaced by a pricier profile", () => {
    for (const id of KRETO_PROFILE_IDS) {
      const r = resolveKretoRoute({ requested: id, effort: 2, text: "a long proposal deck brief ".repeat(20), paidPlan: true, proTierEnabled: true });
      if (r.ok) expect(r.route.profile).toBe(id);
    }
  });

  it("Kreto Oracle is refused while the deepest tier is off, and Kreto Vision is offered", () => {
    expect(PRO_TIER_ENABLED).toBe(false);
    const r = refusal({ requested: "oracle", effort: 4, text: "x", paidPlan: true });
    expect(r).toMatchObject({ ok: false, code: "KRETO_PROFILE_UNAVAILABLE", alternative: "vision" });
    expect(r.message).toBe("Kreto Oracle isn't switched on yet. I can run this with Kreto Vision.");
    expect(route({ requested: "oracle", effort: 2, text: "x", paidPlan: true, proTierEnabled: true }).tier).toBe("pro");
  });

  it("Kreto Vision at Maximum stops at the strong tier while the deepest is off, and says so", () => {
    const r = route({ requested: "vision", effort: 4, text: "x", ...PAID });
    expect(r.tier).toBe("strong");
    expect(r.notice).toMatch(/isn't switched on yet/);
    expect(route({ requested: "vision", effort: 4, text: "x", paidPlan: true, proTierEnabled: true }).tier).toBe("pro");
  });

  it("a paid profile on a free plan is refused with the nearest free one", () => {
    const r = refusal({ requested: "forge", effort: 2, text: "deck", paidPlan: false });
    expect(r).toMatchObject({ ok: false, alternative: "pulse" });
    expect(r.message).toBe("Kreto Forge is on paid plans. I can run this with Kreto Pulse.");
  });

  it("an unknown choice is treated as Auto", () => {
    expect(route({ requested: "gpt-5", text: "hello there", ...PAID }).auto).toBe(true);
  });
});

describe("Auto: cheapest sufficient, never a silent upgrade", () => {
  const SAMPLES = [
    "hi",
    "what's my plan today?",
    "Draft a pitch deck for the Night Shoot with the budget and crew",
    "Chase the overdue invoice from Maya",
    "Find me venues in Port of Spain for a 200-person launch",
    "Any castings this week for a cinematographer?",
    "Plan the launch of my EP over the next six weeks: release, press, two shows and a video, step by step please",
    "x".repeat(800),
  ];

  it("never goes above the tier the effort allows", () => {
    const ceiling: Record<KretoEffort, KretoTier> = { 1: "fast", 2: "strong", 3: "strong", 4: "pro" };
    for (const effort of [1, 2, 3, 4] as KretoEffort[]) {
      for (const text of SAMPLES) {
        for (const proTierEnabled of [false, true]) {
          const r = route({ effort, text, paidPlan: true, proTierEnabled });
          expect(RANK[r.tier], `${effort} ${text.slice(0, 20)}`).toBeLessThanOrEqual(RANK[ceiling[effort]]);
          if (!proTierEnabled) expect(r.tier).not.toBe("pro");
        }
      }
    }
  });

  it("at Balanced the strong tier is used only for documents and multi-step planning", () => {
    for (const text of SAMPLES) {
      const r = route({ effort: 2, text, ...PAID });
      if (r.tier === "strong") expect(["forge", "vision"]).toContain(r.profile);
    }
  });

  it("length alone never upgrades: a long ordinary message stays on the fast tier", () => {
    const r = route({ effort: 2, text: "Tell me about my week and what changed since Monday, with a little more detail on each item please. ".repeat(4), ...PAID });
    expect(r).toMatchObject({ profile: "pulse", tier: "fast", outputTokens: 400 });
  });

  it("Balanced reproduces today's caps: 400 on the fast tier, 800 on the strong one, 40 prior messages", () => {
    expect(route({ effort: 2, text: "quick question", ...PAID })).toMatchObject({ tier: "fast", outputTokens: 400, historyMessages: 40 });
    expect(route({ effort: 2, text: "Draft a proposal for the client", ...PAID })).toMatchObject({ profile: "forge", tier: "strong", outputTokens: 800, historyMessages: 40 });
    expect(route({ effort: 2, text: "summarise this", hasAttachments: true, ...PAID })).toMatchObject({ profile: "forge", tier: "strong" });
  });

  it("picks the profile from what the request is about", () => {
    expect(autoProfile({ text: "hello", voice: true }, 2)).toBe("echo");
    expect(autoProfile({ text: "Chase the overdue invoice" }, 2)).toBe("ledger");
    expect(autoProfile({ text: "what do I owe?", surface: "krepay" }, 2)).toBe("ledger");
    expect(autoProfile({ text: "what's next?", projectSelected: true }, 2)).toBe("studio");
    expect(autoProfile({ text: "Any castings this week?" }, 2)).toBe("scout");
    expect(autoProfile({ text: "Find me venues in Lisbon" }, 2)).toBe("atlas");
    expect(autoProfile({ text: "what's my plan today?" }, 2)).toBe("pulse");
    expect(autoProfile({ text: "hey" }, 1)).toBe("signal");
    expect(autoProfile({ text: "rate my portfolio" }, 2)).toBe("pulse");
    expect(autoProfile({ text: "good job on the edit" }, 2)).toBe("pulse");
  });

  it("offers a higher effort instead of taking it", () => {
    const r = route({ effort: 1, text: "Draft a proposal deck", ...PAID });
    expect(r).toMatchObject({ profile: "forge", tier: "fast", suggestEffort: 2 });
    expect(route({ effort: 2, text: "hello", ...PAID }).suggestEffort).toBeUndefined();
  });

  it("on a free plan Auto stays on free profiles", () => {
    const r = route({ effort: 2, text: "Draft a pitch deck for the shoot", paidPlan: false });
    expect(KRETO_PROFILES[r.profile].paid).toBe(false);
  });
});

describe("guardKretoRequest: ask before a big share, stop before overspending", () => {
  it("runs quietly under the threshold", () => {
    expect(guardKretoRequest({ estimateTokens: 1000, remainingTokens: 20000, estimateCredits: null, weeklyRemainingCredits: null, confirmed: false })).toEqual({ action: "run", share: 0.05 });
  });

  it("asks at or above the threshold, and runs once confirmed", () => {
    const base = { estimateTokens: 5000, remainingTokens: 20000, estimateCredits: null, weeklyRemainingCredits: null };
    expect(DEFAULT_CONFIRM_SHARE).toBe(0.25);
    expect(guardKretoRequest({ ...base, confirmed: false })).toEqual({ action: "confirm", share: 0.25, basis: "today" });
    expect(guardKretoRequest({ ...base, confirmed: true })).toEqual({ action: "run", share: 0.25 });
  });

  it("stops when the request does not fit, even if confirmed", () => {
    expect(guardKretoRequest({ estimateTokens: 5000, remainingTokens: 4000, estimateCredits: null, weeklyRemainingCredits: null, confirmed: true })).toMatchObject({ action: "stop", basis: "today" });
    expect(guardKretoRequest({ estimateTokens: 10, remainingTokens: 0, estimateCredits: null, weeklyRemainingCredits: null, confirmed: true })).toMatchObject({ action: "stop" });
    expect(guardKretoRequest({ estimateTokens: 10, remainingTokens: 10000, estimateCredits: 0.02, weeklyRemainingCredits: 0.01, confirmed: true })).toMatchObject({ action: "stop", basis: "week" });
  });

  it("uses the larger share, and names the week when that is the binding one", () => {
    expect(guardKretoRequest({ estimateTokens: 100, remainingTokens: 10000, estimateCredits: 0.03, weeklyRemainingCredits: 0.1, confirmed: false })).toEqual({ action: "confirm", share: 0.3, basis: "week" });
  });

  it("with no cap to measure against, it runs and reports no share", () => {
    expect(guardKretoRequest({ estimateTokens: 99999, remainingTokens: null, estimateCredits: null, weeklyRemainingCredits: null, confirmed: false })).toEqual({ action: "run", share: null });
  });

  it("rounds the share the way a person reads it", () => {
    expect(sharePct(0.004)).toBe(1);
    expect(sharePct(0.284)).toBe(28);
    expect(sharePct(Infinity)).toBe(100);
  });
});

describe("estimate and weekly allowance", () => {
  const pricing = { cost_currency: "credits", input: { text: { tiers: [{ min: 0, max: null, cost: 0.000001 }] } }, output: { text: { tiers: [{ min: 0, max: null, cost: 0.000004 }] } } };

  it("prices from the catalog, and returns null rather than an invented zero", () => {
    expect(estimateCredits(1000, 500, pricing)).toBeCloseTo(0.003, 9);
    expect(estimateCredits(1000, 500, null)).toBeNull();
    expect(estimateCredits(1000, 500, { cost_currency: "usd" })).toBeNull();
  });

  it("invents no weekly amount: every plan is unset until decided", () => {
    for (const v of Object.values(WEEKLY_CREDIT_ALLOWANCE)) expect(v).toBeNull();
  });

  it("the week starts on Monday 00:00 UTC", () => {
    expect(weekStartUtc(new Date("2026-11-15T10:00:00Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z"); // Sunday
    expect(weekStartUtc(new Date("2026-11-16T00:00:00Z")).toISOString()).toBe("2026-11-16T00:00:00.000Z"); // Monday
  });
});
