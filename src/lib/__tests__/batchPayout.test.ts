import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_BATCH_MILESTONES,
  cleanBatchRequest,
  partitionMilestones,
} from "../../../supabase/functions/_shared/batchPayout";

describe("cleanBatchRequest", () => {
  it("accepts a project id and a list of milestone ids, deduplicated", () => {
    expect(cleanBatchRequest({ projectId: "p1", milestoneIds: ["a", "b", "a"] })).toEqual({
      ok: true,
      projectId: "p1",
      milestoneIds: ["a", "b"],
    });
  });

  it("refuses a missing or non-text project id", () => {
    for (const projectId of [undefined, null, "", 5, {}, ["p1"]]) {
      expect(cleanBatchRequest({ projectId, milestoneIds: ["a"] })).toMatchObject({ ok: false });
    }
  });

  it("refuses a missing, empty or non-array milestone list", () => {
    for (const milestoneIds of [undefined, null, [], "a", { 0: "a" }, 5]) {
      expect(cleanBatchRequest({ projectId: "p1", milestoneIds })).toMatchObject({ ok: false });
    }
  });

  it("refuses ids that are not non-empty strings", () => {
    for (const milestoneIds of [[1], [""], [null], [{}], ["a", 2], [["a"]]]) {
      expect(cleanBatchRequest({ projectId: "p1", milestoneIds })).toMatchObject({ ok: false });
    }
  });

  it("bounds the list, counted after deduplication", () => {
    const many = Array.from({ length: MAX_BATCH_MILESTONES + 1 }, (_, i) => `m${i}`);
    expect(cleanBatchRequest({ projectId: "p1", milestoneIds: many })).toMatchObject({ ok: false });
    expect(cleanBatchRequest({ projectId: "p1", milestoneIds: many.slice(0, MAX_BATCH_MILESTONES) })).toMatchObject({ ok: true });
    expect(cleanBatchRequest({ projectId: "p1", milestoneIds: [...many, ...many] })).toMatchObject({ ok: false });
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, undefined, "x", 5, []]) {
      expect(cleanBatchRequest(body)).toMatchObject({ ok: false });
    }
  });
});

describe("partitionMilestones", () => {
  const rows = [
    { id: "held", status: "review", escrow_status: "authorized", payment_intent_id: "pi_1", paid_at: null },
    { id: "held-no-intent", status: "review", escrow_status: "authorized", payment_intent_id: null, paid_at: null },
    { id: "held-wrong-status", status: "in_progress", escrow_status: "authorized", payment_intent_id: "pi_2", paid_at: null },
    { id: "unpaid", status: "completed", escrow_status: "none", payment_intent_id: null, paid_at: null },
    { id: "already-paid", status: "paid", escrow_status: "captured", payment_intent_id: "pi_3", paid_at: "2026-10-01" },
    { id: "cancelled", status: "review", escrow_status: "cancelled", payment_intent_id: "pi_4", paid_at: null },
  ];

  it("only an escrow held for a milestone in review is capturable", () => {
    const { capturable } = partitionMilestones(rows);
    expect(capturable.map((m) => m.id)).toEqual(["held"]);
  });

  it("a completed milestone with no escrow is reported as not available, never captured", () => {
    const { capturable, notAvailable } = partitionMilestones(rows);
    expect(notAvailable.map((m) => m.id)).toEqual(["unpaid"]);
    expect(capturable.map((m) => m.id)).not.toContain("unpaid");
  });

  it("an already paid, cancelled or half-configured milestone is neither", () => {
    const { capturable, notAvailable } = partitionMilestones(rows);
    const all = [...capturable, ...notAvailable].map((m) => m.id);
    for (const id of ["held-no-intent", "held-wrong-status", "already-paid", "cancelled"]) {
      expect(all).not.toContain(id);
    }
  });

  it("handles no rows", () => {
    expect(partitionMilestones(null)).toEqual({ capturable: [], notAvailable: [] });
    expect(partitionMilestones(undefined)).toEqual({ capturable: [], notAvailable: [] });
    expect(partitionMilestones([])).toEqual({ capturable: [], notAvailable: [] });
  });
});

describe("batch-milestone-payout wiring", () => {
  const src = readFileSync(resolve(__dirname, "../../../supabase/functions/batch-milestone-payout/index.ts"), "utf8");
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, `missing: ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it("uses the shared request check and refuses a missing Authorization header cleanly", () => {
    expect(src).toContain('from "../_shared/batchPayout.ts"');
    expect(src).not.toContain('get("Authorization")!');
    expect(at("cleanBatchRequest(")).toBeLessThan(at("from('projects')"));
  });

  it("keeps the project-level gate before any milestone is read", () => {
    expect(at("authorizedPayers.includes(user.id)")).toBeLessThan(at("from('milestones')"));
  });

  it("binds each release to the payer recorded on the PaymentIntent, before capturing it", () => {
    const bind = at("assertCanReleaseMilestone(");
    expect(src).toContain('from "../_shared/escrowAuth.ts"');
    expect(at("paymentIntents.retrieve(milestone.payment_intent_id)")).toBeLessThan(bind);
    expect(bind).toBeLessThan(at("paymentIntents.capture("));
    expect(at("intent.status !== 'requires_capture'")).toBeLessThan(at("paymentIntents.capture("));
  });

  it("no longer creates a combined Checkout session that nothing reconciles", () => {
    expect(src).not.toContain("checkout.sessions.create");
    expect(src).not.toContain("customers.list");
    expect(src).toContain("not_available");
  });

  it("reports a capture that could not be recorded instead of success", () => {
    expect(src).toContain("captured_not_recorded");
    expect(src).toContain("if (recordError)");
  });
});

describe("MilestoneBoard batch button", () => {
  const board = readFileSync(resolve(__dirname, "../../../src/components/project/MilestoneBoard.tsx"), "utf8");

  it("offers only escrow that is held and in review", () => {
    const i = board.indexOf("const batchPayableMilestones");
    expect(i).toBeGreaterThan(-1);
    const block = board.slice(i, i + 260);
    expect(block).toContain("escrow_status === 'authorized'");
    expect(block).not.toContain("escrow_status === 'none'");
  });
});
