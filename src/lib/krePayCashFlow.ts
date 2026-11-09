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

export const currencyOf = (value: string | null | undefined) => {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
};

export function currenciesFor(invoices: CashFlowInvoice[], expenses: CashFlowExpense[]) {
  return Array.from(new Set([
    ...invoices.map((row) => currencyOf(row.currency)),
    ...expenses.map((row) => currencyOf(row.currency)),
  ].filter((code): code is string => code !== null))).sort();
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
    const interval = {
      start: rangeStart.getTime() > start.getTime() ? rangeStart : start,
      end: rangeEnd.getTime() < end.getTime() ? rangeEnd : end,
    };
    const income = invoices
      .filter((row) => row.status === "paid" && row.paid_at && currencyOf(row.currency) === currency && isDateInInterval(row.paid_at, interval))
      .reduce((sum, row) => sum + Number(row.total_amount ?? row.amount ?? 0), 0);
    const outgoing = expenses
      .filter((row) => currencyOf(row.currency) === currency && isDateInInterval(row.date, interval))
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
  while (cursor.getTime() <= end.getTime()) {
    const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 });
    buckets.push({
      start: cursor.getTime() < start.getTime() ? start : cursor,
      end: weekEnd.getTime() > end.getTime() ? end : weekEnd,
    });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
    cursor = startOfDay(cursor);
  }
  return buckets;
}

function isDateInInterval(value: string, interval: { start: Date; end: Date }) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return !Number.isNaN(date.getTime()) && isWithinInterval(date, interval);
}
