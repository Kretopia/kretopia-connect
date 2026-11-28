import { describe, expect, it } from "vitest";
import { billingNotice, canManageBilling } from "../billingStatus";

describe("billing status wording", () => {
  it("says a failed payment is failed, keeps the work, and points at the portal", () => {
    const n = billingNotice("past_due");
    expect(n?.tone).toBe("warn");
    expect(`${n?.title} ${n?.body}`).toMatch(/failed/i);
    expect(`${n?.title} ${n?.body}`).not.toMatch(/\bactive\b|success|paid in full/i);
    expect(n?.body).toMatch(/work and data stay/i);
  });
  it("has a notice for paused and ended plans and none for healthy or unknown ones", () => {
    expect(billingNotice("paused")?.title).toMatch(/paused/i);
    expect(billingNotice("canceled")?.body).toMatch(/Free plan/);
    for (const s of ["active", "trialing", "none", null, undefined, "weird"]) expect(billingNotice(s as string)).toBeNull();
  });
  it("lets a member with a failing or paused plan reach billing, not one who never subscribed", () => {
    expect(["active", "trialing", "past_due", "paused"].every(canManageBilling)).toBe(true);
    expect(["none", "canceled", null, undefined].some((s) => canManageBilling(s as string))).toBe(false);
  });
});
