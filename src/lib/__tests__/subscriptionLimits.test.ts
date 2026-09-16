import { describe, it, expect } from "vitest";
import {
  TIER_LIMITS,
  canPerformAction,
  getRemainingSwipes,
  canAddPortfolioItem,
  getTierDisplayName,
  getUpgradeMessage,
  getTierLimits,
} from "@/lib/subscriptionLimits";

describe("Subscription Limits", () => {
  describe("TIER_LIMITS (backward compat - individual defaults)", () => {
    it("free tier has correct swipe limit", () => {
      expect(TIER_LIMITS.free.swipesPerDay).toBe(20);
    });

    it("pro tier has unlimited swipes", () => {
      expect(TIER_LIMITS.pro.swipesPerDay).toBe(-1);
    });

    it("free tier cannot undo swipes", () => {
      expect(TIER_LIMITS.free.canUndoSwipe).toBe(false);
    });

    it("pro tier can undo swipes", () => {
      expect(TIER_LIMITS.pro.canUndoSwipe).toBe(true);
    });

    it("free tier limited to 5 portfolio items", () => {
      expect(TIER_LIMITS.free.maxPortfolioItems).toBe(5);
    });

    it("pro tier has unlimited portfolio items", () => {
      expect(TIER_LIMITS.pro.maxPortfolioItems).toBe(-1);
    });
  });

  describe("getTierLimits (account-type-aware)", () => {
    it("company free tier allows 5 opportunity postings", () => {
      const limits = getTierLimits("free", "company");
      expect(limits.maxOpportunityPostings).toBe(5);
    });

    it("company pro tier has unlimited opportunity postings", () => {
      const limits = getTierLimits("pro", "company");
      expect(limits.maxOpportunityPostings).toBe(-1);
    });

    it("company pro tier has applicant tracking", () => {
      const limits = getTierLimits("pro", "company");
      expect(limits.hasApplicantTracking).toBe(true);
    });

    it("individual pro tier does NOT have applicant tracking", () => {
      const limits = getTierLimits("pro", "individual");
      expect(limits.hasApplicantTracking).toBe(false);
    });

    it("company pro tier has branded page", () => {
      const limits = getTierLimits("pro", "company");
      expect(limits.hasBrandedPage).toBe(true);
    });

    it("company pro tier has AI talent scout", () => {
      const limits = getTierLimits("pro", "company");
      expect(limits.hasAITalentScout).toBe(true);
    });
  });

  describe("canPerformAction", () => {
    it("returns false for free tier gated features", () => {
      expect(canPerformAction("free", "canUndoSwipe")).toBe(false);
      expect(canPerformAction("free", "canVerifyProfile")).toBe(false);
      expect(canPerformAction("free", "hasAIMatchExplanations")).toBe(false);
    });

    it("returns true for pro tier features", () => {
      expect(canPerformAction("pro", "canUndoSwipe")).toBe(true);
      expect(canPerformAction("pro", "canVerifyProfile")).toBe(true);
      expect(canPerformAction("pro", "hasAdvancedFilters")).toBe(true);
    });

    it("returns true for free tier numeric limits (truthy check)", () => {
      expect(canPerformAction("free", "swipesPerDay")).toBe(true);
    });

    it("company pro has applicant tracking", () => {
      expect(canPerformAction("pro", "hasApplicantTracking", "company")).toBe(true);
    });

    it("company free does NOT have applicant tracking", () => {
      expect(canPerformAction("free", "hasApplicantTracking", "company")).toBe(false);
    });
  });

  describe("getRemainingSwipes", () => {
    it("calculates remaining swipes for free tier", () => {
      expect(getRemainingSwipes("free", 0)).toBe(20);
      expect(getRemainingSwipes("free", 10)).toBe(10);
      expect(getRemainingSwipes("free", 20)).toBe(0);
      expect(getRemainingSwipes("free", 25)).toBe(0);
    });

    it("returns -1 (unlimited) for pro tier", () => {
      expect(getRemainingSwipes("pro", 0)).toBe(-1);
      expect(getRemainingSwipes("pro", 999)).toBe(-1);
    });
  });

  describe("canAddPortfolioItem", () => {
    it("limits free tier portfolio items", () => {
      expect(canAddPortfolioItem("free", 0)).toBe(true);
      expect(canAddPortfolioItem("free", 4)).toBe(true);
      expect(canAddPortfolioItem("free", 5)).toBe(false);
      expect(canAddPortfolioItem("free", 10)).toBe(false);
    });

    it("allows unlimited for pro tier", () => {
      expect(canAddPortfolioItem("pro", 0)).toBe(true);
      expect(canAddPortfolioItem("pro", 100)).toBe(true);
    });
  });

  describe("getTierDisplayName", () => {
    it("returns correct display names", () => {
      expect(getTierDisplayName("free")).toBe("Spark");
      expect(getTierDisplayName("pro")).toBe("Pro");
    });
  });

  describe("getUpgradeMessage", () => {
    it("returns upgrade messages for free tier", () => {
      const msg = getUpgradeMessage("swipesPerDay", "free");
      expect(msg).toContain("Upgrade to Pro");
    });

    it("returns upgrade messages for company features", () => {
      const msg = getUpgradeMessage("hasApplicantTracking", "free");
      expect(msg).toContain("applicant tracking");
    });

    it("returns unlocked message for pro tier", () => {
      const msg = getUpgradeMessage("swipesPerDay", "pro");
      expect(msg).toContain("unlocked");
    });
  });
});
