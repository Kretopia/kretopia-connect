import { describe, expect, it } from "vitest";
import { buildCashFlow, currenciesFor, type CashFlowExpense, type CashFlowInvoice } from "../krePayCashFlow";

const invoice = (values: Partial<CashFlowInvoice>): CashFlowInvoice => ({
  total_amount: null,
  amount: null,
  currency: "USD",
  status: "paid",
  paid_at: null,
  created_at: "2026-02-01T10:00:00",
  due_date: null,
  ...values,
});

const expense = (values: Partial<CashFlowExpense>): CashFlowExpense => ({
  amount: 0,
  currency: "USD",
  date: "2026-02-01",
  ...values,
});

const totals = (points: ReturnType<typeof buildCashFlow>) =>
  points.reduce((result, point) => ({ income: result.income + point.income, outgoing: result.outgoing + point.outgoing }), { income: 0, outgoing: 0 });

describe("KrePay cash-flow data", () => {
  it("keeps currencies separate and excludes unpaid invoices from income", () => {
    const invoices = [
      invoice({ amount: 120, currency: "USD", paid_at: "2026-02-05T12:00:00" }),
      invoice({ amount: 90, currency: "EUR", paid_at: "2026-02-05T12:00:00" }),
      invoice({ amount: 400, currency: "USD", status: "pending", paid_at: null }),
      invoice({ amount: 60, currency: null, paid_at: "2026-02-05T12:00:00" }),
    ];
    const expenses = [
      expense({ amount: 25, currency: "USD", date: "2026-02-05" }),
      expense({ amount: 10, currency: "EUR", date: "2026-02-05" }),
      expense({ amount: 8, currency: null, date: "2026-02-05" }),
    ];
    const now = new Date(2026, 1, 7, 12);

    expect(currenciesFor(invoices, expenses)).toEqual(["EUR", "USD"]);
    expect(totals(buildCashFlow(invoices, expenses, "USD", "7d", now))).toEqual({ income: 120, outgoing: 25 });
    expect(totals(buildCashFlow(invoices, expenses, "EUR", "7d", now))).toEqual({ income: 90, outgoing: 10 });
  });

  it("counts a transaction on a week boundary once and excludes activity outside the selected range", () => {
    const invoices = [
      invoice({ amount: 20, paid_at: "2026-02-08T23:59:59.999" }),
      invoice({ amount: 30, paid_at: "2026-02-09T00:00:00" }),
      invoice({ amount: 900, paid_at: "2025-12-01T12:00:00" }),
    ];
    const result = buildCashFlow(invoices, [], "USD", "30d", new Date(2026, 1, 15, 12));

    expect(totals(result).income).toBe(50);
    expect(result.length).toBeGreaterThan(1);
  });
});
