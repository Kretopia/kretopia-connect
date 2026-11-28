import { describe, expect, it } from "vitest";
import { projectFinance } from "../projectFinanceTotals";

describe("projectFinance", () => {
  it("never adds amounts of different currencies", () => {
    const r = projectFinance(
      [{ id: "m1", amount: 100, status: "paid" }],
      [{ status: "paid", total_amount: 50, currency: "EUR" }, { status: "paid", total_amount: 30, currency: "USD" }],
      "USD",
    );
    expect(r.byCurrency.map((c) => [c.currency, c.totalEarned])).toEqual([["EUR", 50], ["USD", 130]]);
  });
  it("counts money once when an invoice was drafted from a milestone", () => {
    const r = projectFinance(
      [{ id: "m1", amount: 100, status: "paid" }, { id: "m2", amount: 200, status: "pending" }],
      [
        { status: "paid", total_amount: 100, currency: "USD", milestone_id: "m1" },
        { status: "sent", total_amount: 200, currency: "USD", milestone_id: "m2" },
        { status: "sent", total_amount: 40, currency: "USD" },
      ],
      "USD",
    );
    const usd = r.byCurrency[0];
    expect(usd.totalEarned).toBe(100); // not 200
    expect(usd.totalPending).toBe(240); // 200 unpaid milestone + 40 standalone invoice, not 440
    expect(usd.invoiceOpen).toBe(240); // display: every open invoice
  });
  it("leaves records without a valid currency out of every total and counts them", () => {
    const r = projectFinance([{ id: "m", amount: 10, status: "paid" }], [{ status: "paid", total_amount: 99, currency: null }, { status: "paid", total_amount: 5, currency: "usdollars" }]);
    expect(r.byCurrency).toEqual([]);
    expect(r.excluded).toBe(3);
  });
  it("separates escrow, paid and pending; a draft or cancelled invoice is neither open nor paid", () => {
    const r = projectFinance(
      [{ id: "a", amount: 10, escrow_status: "captured" }, { id: "b", amount: 20, escrow_status: "authorized" }],
      [{ status: "draft", total_amount: 7, currency: "USD" }, { status: "cancelled", total_amount: 9, currency: "USD" }],
      "USD",
    )!.byCurrency[0];
    expect(r).toMatchObject({ milestonePaid: 10, milestoneEscrow: 20, invoiceOpen: 0, standalonePaid: 0, totalEarned: 10, totalPending: 20 });
  });
});
