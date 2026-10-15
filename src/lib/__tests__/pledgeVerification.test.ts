import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  summarizeFinalization,
  toCents,
  verifyPledgeAuthorization,
  type PaymentIntentLike,
} from "../../../supabase/functions/_shared/pledgeVerification";

const CAMPAIGN = "camp-1";
const ctx = { campaignId: CAMPAIGN, campaignCurrency: "USD" };
const pledge = (id = "pl-1", amount: unknown = 25) => ({ id, amount });
const intent = (over: Partial<PaymentIntentLike> = {}): PaymentIntentLike => ({
  id: "pi_1",
  status: "requires_capture",
  amount_capturable: 2500,
  currency: "usd",
  metadata: { pledge_id: "pl-1", campaign_id: CAMPAIGN },
  ...over,
});

describe("toCents", () => {
  it("rounds a positive amount to integer cents", () => {
    expect(toCents(25)).toBe(2500);
    expect(toCents("19.99")).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
  it("refuses anything that is not a positive finite number", () => {
    for (const bad of [0, -5, NaN, Infinity, "abc", "", null, undefined, {}, [], true]) {
      expect(toCents(bad)).toBeNull();
    }
  });
});

describe("verifyPledgeAuthorization: what counts", () => {
  it("counts a pledge whose intent Stripe reports as capturable for at least the pledged amount", () => {
    expect(verifyPledgeAuthorization(pledge(), intent(), ctx)).toEqual({ verified: true, cents: 2500 });
    expect(verifyPledgeAuthorization(pledge(), intent({ amount_capturable: 9999 }), ctx)).toEqual({ verified: true, cents: 2500 });
  });
});

describe("verifyPledgeAuthorization: what does not count (denied paths)", () => {
  it("a pledge with no payment intent: the phantom pledge, created and never paid", () => {
    expect(verifyPledgeAuthorization(pledge(), null, ctx)).toEqual({ verified: false, reason: "no_payment_intent" });
    expect(verifyPledgeAuthorization(pledge(), undefined, ctx)).toEqual({ verified: false, reason: "no_payment_intent" });
  });
  it("an intent that is not authorised and waiting for capture", () => {
    for (const status of ["requires_payment_method", "requires_confirmation", "requires_action", "processing", "canceled", "succeeded", undefined, null]) {
      expect(verifyPledgeAuthorization(pledge(), intent({ status: status as string }), ctx)).toEqual({
        verified: false,
        reason: "intent_not_capturable",
      });
    }
  });
  it("an authorisation that covers less than the pledge", () => {
    expect(verifyPledgeAuthorization(pledge(), intent({ amount_capturable: 2499 }), ctx)).toEqual({ verified: false, reason: "amount_not_covered" });
    expect(verifyPledgeAuthorization(pledge(), intent({ amount_capturable: 0 }), ctx)).toEqual({ verified: false, reason: "amount_not_covered" });
    expect(verifyPledgeAuthorization(pledge(), intent({ amount_capturable: undefined }), ctx)).toEqual({ verified: false, reason: "amount_not_covered" });
  });
  it("an intent that names another pledge or another campaign", () => {
    expect(verifyPledgeAuthorization(pledge(), intent({ metadata: { pledge_id: "pl-2", campaign_id: CAMPAIGN } }), ctx)).toEqual({
      verified: false,
      reason: "wrong_pledge",
    });
    expect(verifyPledgeAuthorization(pledge(), intent({ metadata: { pledge_id: "pl-1", campaign_id: "camp-2" } }), ctx)).toEqual({
      verified: false,
      reason: "wrong_campaign",
    });
    expect(verifyPledgeAuthorization(pledge(), intent({ metadata: null }), ctx)).toEqual({ verified: false, reason: "wrong_pledge" });
  });
  it("an intent in another currency", () => {
    expect(verifyPledgeAuthorization(pledge(), intent({ currency: "eur" }), ctx)).toEqual({ verified: false, reason: "wrong_currency" });
    expect(verifyPledgeAuthorization(pledge(), intent({ currency: null }), ctx)).toEqual({ verified: false, reason: "wrong_currency" });
  });
  it("a pledge whose amount is not a positive number", () => {
    for (const amount of [0, -1, "x", null, NaN]) {
      expect(verifyPledgeAuthorization(pledge("pl-1", amount), intent(), ctx)).toEqual({ verified: false, reason: "bad_amount" });
    }
  });
  it("the campaign currency defaults to USD and is compared case-insensitively", () => {
    expect(verifyPledgeAuthorization(pledge(), intent({ currency: "USD" }), { campaignId: CAMPAIGN })).toMatchObject({ verified: true });
    expect(verifyPledgeAuthorization(pledge(), intent({ currency: "gbp" }), { campaignId: CAMPAIGN, campaignCurrency: "GBP" })).toMatchObject({ verified: true });
  });
});

describe("summarizeFinalization: the goal is met by verified money only", () => {
  it("meets the goal exactly, and one cent short does not", () => {
    expect(summarizeFinalization({ settledCents: 0, verifiedCents: [5000, 5000], goalAmount: 100 })).toEqual({ raisedCents: 10000, goalCents: 10000, goalMet: true });
    expect(summarizeFinalization({ settledCents: 0, verifiedCents: [5000, 4999], goalAmount: 100 })).toMatchObject({ goalMet: false });
  });

  it("the phantom scenario: unverified pledges are simply not in the sum", () => {
    // Three real authorisations of $20 against a $1,000 goal; phantom rows would have made the stored
    // total 1,060. Only the verified ones are passed in.
    const s = summarizeFinalization({ settledCents: 0, verifiedCents: [2000, 2000, 2000], goalAmount: 1000 });
    expect(s.raisedCents).toBe(6000);
    expect(s.goalMet).toBe(false);
  });

  it("already captured or released pledges count as settled, so a re-run keeps the outcome", () => {
    expect(summarizeFinalization({ settledCents: 10000, verifiedCents: [], goalAmount: 100 })).toMatchObject({ goalMet: true });
    expect(summarizeFinalization({ settledCents: 6000, verifiedCents: [4000], goalAmount: 100 })).toMatchObject({ goalMet: true });
  });

  it("a goal that is not a positive number is never met (fail closed)", () => {
    for (const goal of [0, -10, null, undefined, "abc", NaN]) {
      expect(summarizeFinalization({ settledCents: 999999, verifiedCents: [100], goalAmount: goal })).toMatchObject({ goalMet: false, goalCents: null });
    }
  });

  it("sums in integer cents, not floats", () => {
    expect(summarizeFinalization({ settledCents: 0, verifiedCents: [1999, 1], goalAmount: 20 })).toMatchObject({ raisedCents: 2000, goalMet: true });
  });
});

describe("thrivefund-finalize-campaign wiring", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../supabase/functions/thrivefund-finalize-campaign/index.ts"),
    "utf8",
  );

  it("no longer decides the goal from the stored total", () => {
    expect(source).not.toMatch(/Number\(campaign\.total_raised\)\s*>=\s*Number\(campaign\.goal_amount\)/);
    expect(source).toContain("summarizeFinalization({ settledCents, verifiedCents, goalAmount: campaign.goal_amount })");
  });

  it("verifies every authorised pledge at Stripe before it captures or cancels anything", () => {
    const retrieve = source.indexOf("stripe.paymentIntents.retrieve(paymentIntentId)");
    const verify = source.indexOf("verifyPledgeAuthorization(p, intent");
    const decide = source.indexOf("summarizeFinalization({");
    const capture = source.indexOf("stripe.paymentIntents.capture(");
    const cancel = source.indexOf("stripe.paymentIntents.cancel(");
    expect(retrieve).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(retrieve);
    expect(decide).toBeGreaterThan(verify);
    expect(capture).toBeGreaterThan(decide);
    expect(cancel).toBeGreaterThan(decide);
  });

  it("answers 503 and does nothing when a pledge could not be verified", () => {
    const failed = source.indexOf("if (verificationFailed > 0)");
    const capture = source.indexOf("stripe.paymentIntents.capture(");
    expect(failed).toBeGreaterThan(-1);
    expect(failed).toBeLessThan(capture);
    expect(source).toMatch(/verificationFailed > 0\)[\s\S]{0,260}status: 503/);
  });

  it("captures only verified pledges: an unverified one is cancelled before the goal is even consulted", () => {
    const unverified = source.indexOf("if (!checked.verdict.verified)");
    const goal = source.indexOf("if (goalMet) {");
    expect(unverified).toBeGreaterThan(-1);
    expect(goal).toBeGreaterThan(unverified);
    expect(source).toMatch(/if \(!checked\.verdict\.verified\) \{[\s\S]{0,700}continue;/);
  });

  it("keeps the outcome of a campaign that was already finalised", () => {
    expect(source).toContain('campaign.status === "funded" ? true : campaign.status === "failed" ? false : summary.goalMet');
  });

  it("reports the verified total and backer count in the result emails", () => {
    expect(source).toContain(".format(verifiedRaised)");
    expect(source).toContain("backerCount: verifiedCents.length");
    expect(source).not.toContain("format(Number(campaign.total_raised))");
  });

  it("keeps the deadline guard and the admin or cron guard", () => {
    expect(source).toContain("requireAdminOrCron(req)");
    expect(source).toContain("Campaign deadline has not passed yet");
  });
});
