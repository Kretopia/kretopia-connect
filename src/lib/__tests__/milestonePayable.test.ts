import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_MILESTONE_AMOUNT,
  checkMilestonePayable,
  checkoutTitle,
} from "../../../supabase/functions/_shared/milestonePayable";

const open = { status: "completed", escrow_status: "none", paid_at: null, amount: 250 };

describe("checkMilestonePayable: allowed", () => {
  it("an unpaid milestone with no escrow is payable", () => {
    expect(checkMilestonePayable(open)).toEqual({ ok: true, amount: 250 });
  });

  it("a milestone whose escrow was cancelled can be funded again", () => {
    expect(checkMilestonePayable({ ...open, status: "review", escrow_status: "cancelled" })).toEqual({ ok: true, amount: 250 });
  });

  it("a milestone still being worked on is payable (escrow funding before completion)", () => {
    expect(checkMilestonePayable({ ...open, status: "in_progress" })).toMatchObject({ ok: true });
  });

  it("a numeric string from the database is read as a number, in whole cents", () => {
    expect(checkMilestonePayable({ ...open, amount: "99.99" })).toEqual({ ok: true, amount: 99.99 });
    expect(checkMilestonePayable({ ...open, amount: 0.01 })).toEqual({ ok: true, amount: 0.01 });
    expect(checkMilestonePayable({ ...open, amount: MAX_MILESTONE_AMOUNT })).toMatchObject({ ok: true });
  });
});

describe("checkMilestonePayable: denied", () => {
  it("a paid milestone, however it is marked", () => {
    for (const m of [
      { ...open, status: "paid" },
      { ...open, paid_at: "2026-10-01T00:00:00Z" },
      { ...open, escrow_status: "captured" },
    ]) {
      expect(checkMilestonePayable(m)).toEqual({ ok: false, status: 409, error: "This milestone has already been paid." });
    }
  });

  it("a milestone whose escrow is already held is not a candidate for a second payment", () => {
    for (const status of ["review", "completed", "in_progress"]) {
      expect(checkMilestonePayable({ ...open, status, escrow_status: "authorized" })).toEqual({
        ok: false,
        status: 409,
        error: "Funds for this milestone are already held in escrow.",
      });
    }
  });

  it("an amount that cannot be charged: missing, zero, negative, non-finite, non-numeric", () => {
    for (const amount of [null, undefined, 0, -5, -0.01, NaN, Infinity, "abc", "", {}, [], true]) {
      expect(checkMilestonePayable({ ...open, amount })).toMatchObject({ ok: false, status: 422 });
    }
  });

  it("an amount with fractions of a cent, or above the ceiling", () => {
    for (const amount of [0.005, 10.001, 99.999, MAX_MILESTONE_AMOUNT + 0.01, 1e12]) {
      expect(checkMilestonePayable({ ...open, amount })).toMatchObject({ ok: false, status: 422 });
    }
  });

  it("the paid check wins over the amount check", () => {
    expect(checkMilestonePayable({ ...open, status: "paid", amount: null })).toMatchObject({ status: 409 });
  });
});

describe("checkoutTitle", () => {
  it("prefers the milestone's own title and clips what it uses", () => {
    expect(checkoutTitle("Logo design", "client text")).toBe("Logo design");
    expect(checkoutTitle("x".repeat(500), null)).toHaveLength(120);
  });
  it("falls back to the client's title, then to a fixed word", () => {
    expect(checkoutTitle(null, "  From client ")).toBe("From client");
    expect(checkoutTitle("", undefined)).toBe("Milestone");
    expect(checkoutTitle(5, {})).toBe("Milestone");
  });
});

describe("create-milestone-payment wiring", () => {
  const src = readFileSync(resolve(__dirname, "../../../supabase/functions/create-milestone-payment/index.ts"), "utf8");
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, `missing: ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it("imports the shared check and refuses a missing Authorization header cleanly", () => {
    expect(src).toContain('from "../_shared/milestonePayable.ts"');
    expect(src).not.toContain('get("Authorization")!');
  });

  it("keeps the caller-must-be-the-project's-payer gate before the payable check and any Stripe call", () => {
    expect(at("authorizedPayers.includes(user.id)")).toBeLessThan(at("checkMilestonePayable("));
    expect(at("checkMilestonePayable(")).toBeLessThan(at("customers.list"));
    expect(at("checkMilestonePayable(")).toBeLessThan(at("checkout.sessions.create"));
  });

  it("reads the milestone's escrow state, payment date, title and project from its own row", () => {
    expect(src).toContain("'created_by, status, amount, project_id, title, escrow_status, paid_at'");
    expect(src).toContain("const projectId: string = milestone.project_id;");
  });

  it("no longer takes the project id from the request body", () => {
    expect(src).not.toMatch(/const \{[^}]*\bprojectId\b[^}]*\} = await req\.json\(\)/);
  });

  it("uses the payable amount, and leaves fees, line items, metadata and the idempotency key as they were", () => {
    expect(src).toContain("const talentRate = payable.amount;");
    expect(src).toContain("capture_method: 'manual'");
    expect(src).toContain("kind: 'milestone'");
    expect(src).toContain("`milestone-payment:${milestoneId}:${user.id}:${brandTotalCents}`");
    expect(src).toContain("unit_amount: Math.round(talentRate * 100)");
  });
});
