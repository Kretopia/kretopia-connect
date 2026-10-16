import { describe, expect, it } from "vitest";
import {
  diversifyByRole,
  interestTokens,
  isPositivelyRealMember,
  orderCandidates,
  recencyBoost,
  stableUnit,
} from "../matchRanking";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const c = (user_id: string, score: number, extra: Record<string, unknown> = {}) => ({ user_id, score, role: "Photographer", ...extra });

describe("stableUnit", () => {
  it("is deterministic, in [0, 1) and seed-sensitive", () => {
    expect(stableUnit("me:you")).toBe(stableUnit("me:you"));
    for (const seed of ["", "a", "me:you", "😀"]) {
      const v = stableUnit(seed);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(stableUnit("viewer-1:x")).not.toBe(stableUnit("viewer-2:x"));
  });
});

describe("interestTokens", () => {
  it("stems loosely so photographer ~ photography, and drops stop words", () => {
    const a = interestTokens("Photographer");
    const b = interestTokens([{ skill: "Photography" }]);
    expect([...a].some((t) => b.has(t))).toBe(true);
    expect(interestTokens("the and for").size).toBe(0);
  });
});

describe("recencyBoost", () => {
  it("rewards recent profile activity in tiers and ignores missing or bad dates", () => {
    expect(recencyBoost(daysAgo(3), NOW)).toBe(6);
    expect(recencyBoost(daysAgo(30), NOW)).toBe(3);
    expect(recencyBoost(daysAgo(400), NOW)).toBe(0);
    expect(recencyBoost(null, NOW)).toBe(0);
    expect(recencyBoost("not a date", NOW)).toBe(0);
    expect(recencyBoost(daysAgo(-5), NOW)).toBe(0);
  });
});

describe("isPositivelyRealMember", () => {
  it("lets in real activity, keeps out imports that only finished 'onboarding'", () => {
    expect(isPositivelyRealMember({ onboarding_completed: true, xp: 120 })).toBe(true);
    expect(isPositivelyRealMember({ onboarding_completed: true, xp: 0, id_verified: true })).toBe(true);
    // what create_unclaimed_profile produces: onboarding true, no XP, no ID check
    expect(isPositivelyRealMember({ onboarding_completed: true, xp: 0, id_verified: false })).toBe(false);
    expect(isPositivelyRealMember({ onboarding_completed: true })).toBe(false);
    expect(isPositivelyRealMember({ onboarding_completed: false, xp: 500 })).toBe(false);
  });
});

describe("orderCandidates", () => {
  it("ranks by score and never drops anyone (weak matches are backfill, not exclusions)", () => {
    const out = orderCandidates([c("weak", 1), c("strong", 90), c("mid", 40)], { now: NOW });
    expect(out.map((x) => x.user_id)).toEqual(["strong", "mid", "weak"]);
    expect(out).toHaveLength(3);
  });

  it("is deterministic: equal scores order by freshest profile then id, whatever the input order", () => {
    const a = c("a", 10, { updated_at: daysAgo(100) });
    const b = c("b", 10, { updated_at: daysAgo(100) });
    const fresh = c("z", 10, { updated_at: daysAgo(100.5) });
    const forward = orderCandidates([a, b, fresh], { now: NOW }).map((x) => x.user_id);
    const reversed = orderCandidates([fresh, b, a], { now: NOW }).map((x) => x.user_id);
    expect(forward).toEqual(reversed);
    expect(forward).toEqual(["a", "b", "z"]);
  });

  it("shows anyone who already swiped right on you first, even against a much better score", () => {
    const out = orderCandidates([c("best", 120), c("likes-you", 3), c("also-likes", 9)], {
      likedYouIds: new Set(["likes-you", "also-likes"]),
      now: NOW,
    });
    expect(out.map((x) => x.user_id)).toEqual(["also-likes", "likes-you", "best"]);
  });

  it("prefers a recently updated profile when interest scores are close", () => {
    const out = orderCandidates([c("stale", 20, { updated_at: daysAgo(300) }), c("active", 18, { updated_at: daysAgo(2) })], { now: NOW });
    expect(out[0].user_id).toBe("active");
  });

  it("does not mutate its input", () => {
    const input = [c("a", 1), c("b", 2)];
    const snapshot = JSON.stringify(input);
    orderCandidates(input, { now: NOW });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("diversifyByRole", () => {
  const r = (id: string, role: string) => ({ id, role });
  it("breaks a run of three identical roles when a different one is nearby", () => {
    const out = diversifyByRole([r("1", "Dancer"), r("2", "Dancer"), r("3", "Dancer"), r("4", "Singer")]);
    expect(out.map((x) => x.id)).toEqual(["1", "2", "4", "3"]);
  });

  it("keeps strong ordering when nothing different is within reach, and loses nobody", () => {
    const same = [r("1", "Dancer"), r("2", "Dancer"), r("3", "Dancer"), r("4", "Dancer")];
    expect(diversifyByRole(same).map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
    const far = [...same, r("9", "Singer")];
    expect(diversifyByRole(far, 3).map((x) => x.id).sort()).toEqual(["1", "2", "3", "4", "9"]);
  });
});
