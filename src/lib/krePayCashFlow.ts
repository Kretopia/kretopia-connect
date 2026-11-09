import {
  endOfDay,
  endOfWeek,
  eachDayOfInterval,
  format,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";

export type CashFlowRange = "7d" | "30d" | "90d";

export interface CashFlowInvoice {
  total_amount: number | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  paid_at: string | null;
  created_at: string;
  due_date: string | null;
}

export interface CashFlowExpense {
  amount: number | null;
  currency: string | null;
  date: string;
}

export interface CashFlowBucket {
  label: string;
  income: number;
  outgoing: number;
}

export const currencyOf = (value: string | null | undefined) => (value || "USD").toUpperCase();

export function currenciesFor(invoices: CashFlowInvoice[], expenses: CashFlowExpense[]) {
  return Array.from(new Set([
    ...invoices.map((row) => currencyOf(row.currency)),
    ...expenses.map((row) => currencyOf(row.currency)),
  ])).sort();
}

export function buildCashFlow(
  invoices: CashFlowInvoice[],
  expenses: CashFlowExpense[],
  currency: string,
  range: CashFlowRange,
  now = new Date(),
): CashFlowBucket[] {
  const days = Number.parseInt(range, 10);
  const rangeStart = startOfDay(subDays(now, days - 1));
  const rangeEnd = endOfDay(now);
  const dayBuckets = range === "7d"
    ? eachDayOfInterval({ start: rangeStart, end: startOfDay(now) }).map((date) => ({
        start: startOfDay(date),
        end: endOfDay(date),
      }))
    : weeklyBuckets(rangeStart, rangeEnd);

  return dayBuckets.map(({ start, end }) => {
    const interval = { start: rangeStart > start ? rangeStart : start, end: rangeEnd < end ? rangeEnd : end };
    const income = invoices
      .filter((row) => row.status === "paid" && row.paid_at && currencyOf(row.currency) === currency && isWithinInterval(new Date(row.paid_at), interval))
      .reduce((sum, row) => sum + Number(row.total_amount ?? row.amount ?? 0), 0);
    const outgoing = expenses
      .filter((row) => currencyOf(row.currency) === currency && isWithinInterval(new Date(row.date), interval))
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return {
      label: format(start, range === "7d" ? "EEE" : "MMM d"),
      income,
      outgoing,
    };
  });
}

function weeklyBuckets(start: Date, end: Date) {
  const buckets: Array<{ start: Date; end: Date }> = [];
  let cursor = startOfWeek(start, { weekStartsOn: 1 });
  while (cursor <= end) {
    buckets.push({ start: cursor, end: endOfWeek(cursor, { weekStartsOn: 1 }) });
    cursor = startOfDay(new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000));
  }
  return buckets;
}
