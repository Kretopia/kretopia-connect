import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKER_MESSAGE_MAX,
  MAX_PLEDGE_AMOUNT,
  checkPledgeRequest,
  classifyOpenPledge,
} from "../../../supabase/functions/_shared/pledgeRequest";

const campaign = { creator_id: "creator-1" };
const base = { amount: 25, isAnonymous: false, backerMessage: "Good luck" };

describe("checkPledgeRequest: allowed", () => {
  it("accepts an ordinary pledge and normalises it", () => {
    expect(checkPledgeRequest(base, campaign, "backer-1")).toEqual({
      ok: true,
      amount: 25,
      amountCents: 2500,
      isAnonymous: false,
      backerMessage: "Good luck",
    });
  });
  it("accepts a numeric string and two decimals, and the ceiling itself", () => {
    expect(checkPledgeRequest({ ...base, amount: "19.99" }, campaign, "b")).toMatchObject({ ok: true, amountCents: 1999 });
    expect(checkPledgeRequest({ ...base, amount: MAX_PLEDGE_AMOUNT }, campaign, "b")).toMatchObject({ ok: true });
    expect(checkPledgeRequest({ ...base, amount: 0.01 }, campaign, "b")).toMatchObject({ ok: true, amountCents: 1 });
  });
  it("isAnonymous is true only for the literal true", () => {
    expect(checkPledgeRequest({ ...base, isAnonymous: true }, campaign, "b")).toMatchObject({ ok: true, isAnonymous: true });
    for (const v of ["true", 1, "yes", {}, null, undefined]) {
      expect(checkPledgeRequest({ ...base, isAnonymous: v }, campaign, "b")).toMatchObject({ ok: true, isAnonymous: false });
    }
  });
});

describe("checkPledgeRequest: denied", () => {
  it("the campaign's own creator cannot back it (403), whatever the amount", () => {
    expect(checkPledgeRequest(base, campaign, "creator-1")).toEqual({ ok: false, status: 403, error: "You cannot back your own campaign" });
    expect(checkPledgeRequest({ ...base, amount: -1 }, campaign, "creator-1")).toMatchObject({ ok: false, status: 403 });
  });
  it("an amount above the ceiling", () => {
    expect(checkPledgeRequest({ ...base, amount: MAX_PLEDGE_AMOUNT + 0.01 }, campaign, "b")).toMatchObject({ ok: false, status: 400 });
    expect(checkPledgeRequest({ ...base, amount: 1e9 }, campaign, "b")).toMatchObject({ ok: false, status: 400 });
  });
  it("an amount that is not a positive finite number", () => {
    for (const bad of [0, -5, NaN, Infinity, -Infinity, "abc", "", "  ", null, undefined, {}, [], true]) {
      expect(checkPledgeRequest({ ...base, amount: bad }, campaign, "b")).toMatchObject({ ok: false, status: 400 });
    }
  });
  it("more than two decimals, and less than one cent", () => {
    expect(checkPledgeRequest({ ...base, amount: 10.005 }, campaign, "b")).toMatchObject({ ok: false, status: 400 });
    expect(checkPledgeRequest({ ...base, amount: 0.001 }, campaign, "b")).toMatchObject({ ok: false, status: 400 });
  });
  it("honours a lower ceiling when one is given", () => {
    expect(checkPledgeRequest({ ...base, amount: 600 }, campaign, "b", 500)).toMatchObject({ ok: false, status: 400 });
  });
});

describe("the backer message", () => {
  it("is a clipped string without control characters, or null", () => {
    expect(checkPledgeRequest({ ...base, backerMessage: "a\u0000b\u0007c" }, campaign, "b")).toMatchObject({ backerMessage: "abc" });
    expect(checkPledgeRequest({ ...base, backerMessage: "x".repeat(5000) }, campaign, "b")).toMatchObject({
      backerMessage: "x".repeat(BACKER_MESSAGE_MAX),
    });
    for (const v of [{ a: 1 }, ["a"], 12, null, undefined, "   ", ""]) {
      expect(checkPledgeRequest({ ...base, backerMessage: v }, campaign, "b")).toMatchObject({ ok: true, backerMessage: null });
    }
  });
});

describe("classifyOpenPledge: one live pledge per account and campaign", () => {
  it("a completed session is a pledge already made", () => {
    expect(classifyOpenPledge({ status: "complete" })).toBe("already_backed");
  });
  it("an open session is superseded; an expired or missing one is dead", () => {
    expect(classifyOpenPledge({ status: "open" })).toBe("supersede");
    expect(classifyOpenPledge({ status: "expired" })).toBe("dead");
    expect(classifyOpenPledge(null)).toBe("dead");
    expect(classifyOpenPledge(undefined)).toBe("dead");
  });
  it("anything Stripe says that is not understood is unknown, so nothing is created", () => {
    expect(classifyOpenPledge({ status: "something_new" })).toBe("unknown");
    expect(classifyOpenPledge({ status: null })).toBe("unknown");
    expect(classifyOpenPledge({})).toBe("unknown");
  });
});

describe("thrivefund-create-pledge wiring", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/thrivefund-create-pledge/index.ts"), "utf8");

  it("checks the request after the campaign is read and before anything is created", () => {
    const campaignRead = source.indexOf('.from("campaigns")');
    const check = source.indexOf("checkPledgeRequest({ amount, isAnonymous, backerMessage }, campaign, user.id)");
    const tier = source.indexOf('.from("pledge_tiers")');
    const insert = source.indexOf('.from("pledges")\n      .insert(');
    expect(campaignRead).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(campaignRead);
    expect(tier).toBeGreaterThan(check);
    expect(insert).toBeGreaterThan(tier);
    expect(source).toContain("if (!checked.ok) return refuse(checked.status, checked.error)");
  });

  it("uses the checked values and never the raw request values for money and text", () => {
    expect(source).not.toContain("Number(amount)");
    expect(source).toContain("const amountCents = checked.amountCents");
    expect(source).toContain("amount: checked.amount,");
    expect(source).toContain("is_anonymous: checked.isAnonymous");
    expect(source).toContain("backer_message: checked.backerMessage");
    expect(source).not.toContain("!amount || amount <= 0");
  });

  it("settles the backer's earlier pledges before it creates a new one, failing closed", () => {
    const earlier = source.indexOf('.eq("capture_status", "authorized")');
    const insert = source.indexOf('.from("pledges")\n      .insert(');
    const session = source.indexOf("stripe.checkout.sessions.create(");
    expect(earlier).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(earlier);
    expect(session).toBeGreaterThan(insert);
    expect(source).toContain('action === "already_backed"');
    expect(source).toMatch(/already_backed"\) return refuse\(409/);
    expect(source).toMatch(/action === "unknown"\) return refuse\(503/);
    expect(source).toContain("stripe.checkout.sessions.expire(old.stripe_checkout_session_id)");
    expect(source).toMatch(/earlierErr\) return refuse\(503/);
  });

  it("keeps the payment mechanics exactly as they were", () => {
    expect(source).toContain('capture_method: "manual"');
    expect(source).toContain("application_fee_amount: platformFeeCents");
    expect(source).toContain("transfer_data: { destination: creator.stripe_account_id }");
    expect(source).toContain('capture_status: "authorized"');
  });
});
