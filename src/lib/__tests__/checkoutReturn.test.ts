import { describe, expect, it } from "vitest";
import { isPaidTier, milestoneReturnNotice, subscriptionReturnState } from "../checkoutReturn";

describe("a browser return from checkout is not a payment", () => {
  it("?payment=success is a neutral notice that says Stripe has not confirmed it", () => {
    const n = milestoneReturnNotice("success");
    expect(n?.kind).toBe("pending");
    expect(`${n?.title} ${n?.description}`).not.toMatch(/received|paid|success/i);
    expect(n?.description).toMatch(/not confirmed/i);
  });
  it("cancelled says no charge was made; anything else has no notice", () => {
    expect(milestoneReturnNotice("cancelled")).toMatchObject({ kind: "cancelled", description: "No charge was made." });
    expect(milestoneReturnNotice(null)).toBeNull();
    expect(milestoneReturnNotice("other")).toBeNull();
  });
});

describe("subscriptionReturnState", () => {
  it("is confirmed only when verification worked and the profile carries a paid tier", () => {
    expect(subscriptionReturnState({ verificationFailed: false, tier: "pro" })).toBe("confirmed");
    expect(subscriptionReturnState({ verificationFailed: false, tier: "founder" })).toBe("confirmed");
  });
  it("a verification error, a free tier or no tier is never an active plan", () => {
    expect(subscriptionReturnState({ verificationFailed: true, tier: "pro" })).toBe("unconfirmed");
    expect(subscriptionReturnState({ verificationFailed: false, tier: "free" })).toBe("unconfirmed");
    expect(subscriptionReturnState({ verificationFailed: false, tier: null })).toBe("unconfirmed");
    expect(subscriptionReturnState({ verificationFailed: false })).toBe("unconfirmed");
  });
  it("isPaidTier knows the paid tiers", () => {
    for (const t of ["pro", "creator_pro", "founder", "brand_pro", "brand_enterprise"]) expect(isPaidTier(t)).toBe(true);
    expect(isPaidTier("free")).toBe(false);
  });
});
