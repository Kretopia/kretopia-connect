// Project finance totals that never lie about money: one set of figures PER CURRENCY (amounts in different currencies are never added),
// and money that is documented twice is counted once.
//
// Double counting: an invoice can be drafted from a milestone (`invoice.milestone_id`). The milestone is then the source of truth for
// that money, so a linked invoice never adds to "earned" or "pending" on top of it (it still counts as an open invoice for display).
// Unknown currency: a record with no valid ISO code is excluded from every total and counted, so the page can say so.

import { currencyOf } from "@/lib/krePayCashFlow";

export interface FinanceMilestone {
  id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  escrow_status?: string | null;
}

export interface FinanceInvoice {
  total_amount?: number | null;
  amount?: number | null;
  currency?: string | null;
  status: string;
  document_type?: string | null;
  milestone_id?: string | null;
}

export interface CurrencyTotals {
  currency: string;
  milestoneTotal: number;
  milestonePaid: number;
  milestoneEscrow: number;
  /** Every open invoice, linked to a milestone or not (display). */
  invoiceOpen: number;
  /** Standalone invoices only: what is already counted through a milestone is not added again. */
  standalonePaid: number;
  standaloneOpen: number;
  totalEarned: number;
  totalPending: number;
}

export interface ProjectFinance {
  byCurrency: CurrencyTotals[];
  /** Records left out of every total because they carry no valid currency. */
  excluded: number;
}

const OPEN = ["sent", "viewed", "overdue"];
const num = (v: unknown) => Number(v || 0);
const invoiceAmount = (i: FinanceInvoice) => num(i.total_amount || i.amount);
const milestonePaid = (m: FinanceMilestone) => m.status === "paid" || m.escrow_status === "captured";

export function projectFinance(milestones: FinanceMilestone[], invoices: FinanceInvoice[], projectCurrency?: string | null): ProjectFinance {
  const fallback = currencyOf(projectCurrency);
  const table = new Map<string, CurrencyTotals>();
  const bucket = (currency: string) => {
    let row = table.get(currency);
    if (!row) {
      row = { currency, milestoneTotal: 0, milestonePaid: 0, milestoneEscrow: 0, invoiceOpen: 0, standalonePaid: 0, standaloneOpen: 0, totalEarned: 0, totalPending: 0 };
      table.set(currency, row);
    }
    return row;
  };
  let excluded = 0;

  const linkedIds = new Set(milestones.map((m) => m.id).filter((id): id is string => !!id));
  for (const m of milestones) {
    const currency = currencyOf(m.currency) ?? fallback;
    if (!currency) { excluded += 1; continue; }
    const row = bucket(currency);
    const amount = num(m.amount);
    row.milestoneTotal += amount;
    if (milestonePaid(m)) row.milestonePaid += amount;
    else if (m.escrow_status === "authorized") row.milestoneEscrow += amount;
  }
  for (const i of invoices) {
    const currency = currencyOf(i.currency);
    if (!currency) { excluded += 1; continue; }
    const row = bucket(currency);
    const linked = !!i.milestone_id && linkedIds.has(i.milestone_id);
    const amount = invoiceAmount(i);
    if (OPEN.includes(i.status)) {
      row.invoiceOpen += amount;
      if (!linked) row.standaloneOpen += amount;
    } else if (i.status === "paid" && !linked) {
      row.standalonePaid += amount;
    }
  }
  for (const row of table.values()) {
    row.totalEarned = row.milestonePaid + row.standalonePaid;
    row.totalPending = row.milestoneTotal - row.milestonePaid + row.standaloneOpen;
  }
  return { byCurrency: Array.from(table.values()).sort((a, b) => a.currency.localeCompare(b.currency)), excluded };
}
