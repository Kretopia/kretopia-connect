import { describe, expect, it } from "vitest";
import { invoiceLedgerStatus } from "../ledgerStatus";

const NOW = new Date("2026-11-28T12:00:00Z");
describe("invoiceLedgerStatus", () => {
  it("calls an invoice confirmed only with a provider reference; otherwise it is the issuer's word", () => {
    expect(invoiceLedgerStatus({ status: "paid", stripe_payment_intent_id: "pi_1" }).key).toBe("provider_confirmed");
    expect(invoiceLedgerStatus({ status: "paid" }).key).toBe("recorded_by_issuer");
    expect(invoiceLedgerStatus({ status: "paid", stripe_payment_intent_id: "  " }).key).toBe("recorded_by_issuer");
    expect(invoiceLedgerStatus({ status: "paid" }).label).not.toMatch(/confirmed/i);
  });
  it("never says Paid for a sent, draft, pending or failed invoice", () => {
    for (const inv of [{ status: "sent" }, { status: "draft" }, { status: "sent", pending_manual_review: true }, { status: "failed" }]) {
      expect(invoiceLedgerStatus(inv, NOW).label).not.toMatch(/paid|confirmed/i);
    }
  });
  it("pending manual review beats sent; a past due date makes a sent invoice overdue", () => {
    expect(invoiceLedgerStatus({ status: "sent", pending_manual_review: true }, NOW).key).toBe("pending_review");
    expect(invoiceLedgerStatus({ status: "sent", due_date: "2026-11-01" }, NOW).key).toBe("overdue");
    expect(invoiceLedgerStatus({ status: "viewed", due_date: "2026-12-30" }, NOW)).toMatchObject({ key: "sent", label: "Sent · viewed" });
  });
  it("claims nothing for an unrecognised status", () => {
    expect(invoiceLedgerStatus({ status: "weird" }).key).toBe("unknown");
    expect(invoiceLedgerStatus({}).key).toBe("unknown");
  });
});
