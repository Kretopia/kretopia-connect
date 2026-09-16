import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  Sparkles,
  Receipt,
  FileText,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  format,
  subDays,
  eachWeekOfInterval,
  eachDayOfInterval,
} from "date-fns";

interface InvoiceRow {
  total_amount: number | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  paid_at: string | null;
  due_date: string | null;
  created_at: string;
  issued_by: string;
  issued_to: string | null;
}
interface ExpenseRow {
  amount: number | null;
  currency: string | null;
  category: string | null;
  date: string;
}

type Range = "7d" | "30d" | "90d";
type SeriesFilter = "both" | "income" | "outgoing";

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

/**
 * KREPAY_DASHBOARD_DATA_CONTRACT.md documents the source/calculation/role-
 * visibility for every metric here. This is the single unified dashboard
 * required by the overhaul spec — it replaces two previously-separate
 * cards (MoneyBrief's hero tiles, WeeklyMoneyInsights' text list), which
 * had real overlapping metrics (two different "overdue" signals, two
 * different "earned this week" figures). It deliberately does NOT repeat
 * the wallet's own "Available to cash out" balance — ThriveWalletCard
 * already owns that number prominently; showing it again here would be
 * exactly the redundant-metric duplication the spec warns against. This
 * component's job is money *flow* (in/out/owed/trend), not point-in-time
 * balance. All figures come from the same source those cards already used
 * (the signed-in user's own `invoices`/`expenses` rows) — nothing is
 * fabricated for visual polish, and every number is server-authoritative
 * (read-only queries scoped by RLS to `auth.uid()`, never client-writable).
 */
export function KrePayDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [range, setRange] = useState<Range>("30d");
  const [seriesFilter, setSeriesFilter] = useState<SeriesFilter>("both");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const cols = "total_amount,amount,currency,status,paid_at,due_date,created_at,issued_by,issued_to";
    Promise.all([
      supabase.from("invoices").select(cols).eq("issued_by", user.id).then((r) => (r.data as InvoiceRow[]) ?? [], () => []),
      supabase.from("expenses").select("amount,currency,category,date").eq("user_id", user.id).then((r) => (r.data as ExpenseRow[]) ?? [], () => []),
    ])
      .then(([inv, exp]) => {
        if (cancelled) return;
        setInvoices(inv);
        setExpenses(exp);
      })
      .catch(() => setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const fmt = (n: number, currency = "USD") =>
    n.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 });

  // Summary tiles — same calculation MoneyBrief used (hero variant, now retired).
  const summary = useMemo(() => {
    const monthRange = { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
    let inThisMonth = 0;
    let owedToYou = 0;
    let overdueCount = 0;
    const now = new Date();
    invoices.forEach((i) => {
      const amt = Number(i.total_amount || i.amount || 0);
      if (i.status === "paid" && i.paid_at && isWithinInterval(new Date(i.paid_at), monthRange)) inThisMonth += amt;
      if (i.status !== "paid" && i.status !== "cancelled") {
        owedToYou += amt;
        if (i.due_date && new Date(i.due_date) < now) overdueCount += 1;
      }
    });
    let outThisMonth = 0;
    expenses.forEach((e) => {
      if (e.date && isWithinInterval(new Date(e.date), monthRange)) outThisMonth += Number(e.amount || 0);
    });
    return { inThisMonth, outThisMonth, owedToYou, overdueCount };
  }, [invoices, expenses]);

  // Chart series — bucketed by day (7d) or week (30d/90d) across the
  // selected range. Same underlying rows the tiles above use, just
  // grouped over time instead of collapsed to one number.
  const chartData = useMemo(() => {
    const days = RANGE_DAYS[range];
    const end = new Date();
    const start = subDays(end, days);
    const buckets = range === "7d" ? eachDayOfInterval({ start, end }) : eachWeekOfInterval({ start, end });

    return buckets.map((bucketStart, i) => {
      const bucketEnd = range === "7d" ? bucketStart : (buckets[i + 1] ?? end);
      const interval = { start: bucketStart, end: bucketEnd };
      const income = invoices
        .filter((inv) => inv.status === "paid" && inv.paid_at && isWithinInterval(new Date(inv.paid_at), interval))
        .reduce((s, inv) => s + Number(inv.total_amount || inv.amount || 0), 0);
      const outgoing = expenses
        .filter((e) => e.date && isWithinInterval(new Date(e.date), interval))
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      return {
        label: format(bucketStart, range === "7d" ? "EEE" : "MMM d"),
        income,
        outgoing,
      };
    });
  }, [invoices, expenses, range]);

  const chartTotals = useMemo(
    () => chartData.reduce((acc, d) => ({ income: acc.income + d.income, outgoing: acc.outgoing + d.outgoing }), { income: 0, outgoing: 0 }),
    [chartData],
  );

  // Weekly insights — same calculation WeeklyMoneyInsights used, folded in
  // as a compact footer instead of a separate card.
  const insights = useMemo(() => {
    const weekRange = { start: startOfWeek(new Date()), end: endOfWeek(new Date()) };
    const list: { icon: typeof TrendingUp; text: string; tone: "positive" | "warn" | "neutral" }[] = [];

    const earnedThisWeek = invoices
      .filter((i) => i.status === "paid" && i.paid_at && isWithinInterval(new Date(i.paid_at), weekRange))
      .reduce((s, i) => s + Number(i.total_amount || i.amount || 0), 0);
    if (earnedThisWeek > 0) list.push({ icon: TrendingUp, tone: "positive", text: `You earned ${fmt(earnedThisWeek)} this week` });

    const overdue = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.due_date && new Date(i.due_date) < new Date());
    if (overdue.length > 0) {
      const overdueAmt = overdue.reduce((s, i) => s + Number(i.total_amount || i.amount || 0), 0);
      list.push({ icon: AlertCircle, tone: "warn", text: `${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} — ${fmt(overdueAmt)} unpaid` });
    }

    const expWeek = expenses.filter((e) => e.date && isWithinInterval(new Date(e.date), weekRange));
    if (expWeek.length > 0) {
      const byCat: Record<string, number> = {};
      expWeek.forEach((e) => {
        const c = e.category || "other";
        byCat[c] = (byCat[c] || 0) + Number(e.amount || 0);
      });
      const top = Object.entries(byCat).sort(([, a], [, b]) => b - a)[0];
      list.push({ icon: Receipt, tone: "neutral", text: `Top spend this week: ${top[0]} (${fmt(top[1])})` });
    }

    const sentThisWeek = invoices.filter((i) => isWithinInterval(new Date(i.created_at), weekRange));
    if (sentThisWeek.length > 0) list.push({ icon: FileText, tone: "neutral", text: `${sentThisWeek.length} invoice${sentThisWeek.length > 1 ? "s" : ""} sent this week` });

    return list;
  }, [invoices, expenses]);

  if (!user) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 h-64 animate-pulse bg-muted/30" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Couldn't load your money dashboard right now.{" "}
          <button onClick={() => window.location.reload()} className="underline text-foreground">Retry</button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Money dashboard</CardTitle>
          <div className="flex items-center gap-1" role="tablist" aria-label="Chart date range">
            {(["7d", "30d", "90d"] as Range[]).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold transition-colors",
                  range === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Summary tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <Tile label="In this month" value={fmt(summary.inThisMonth)} tone="positive" icon={TrendingUp} />
          <Tile label="Out this month" value={fmt(summary.outThisMonth)} tone="negative" icon={TrendingDown} />
          <Tile
            label="Owed to you"
            value={fmt(summary.owedToYou)}
            tone={summary.overdueCount ? "warn" : "neutral"}
            subtitle={summary.overdueCount ? `${summary.overdueCount} overdue` : undefined}
            icon={summary.overdueCount ? AlertCircle : Clock}
          />
          <Tile label="Net this month" value={fmt(summary.inThisMonth - summary.outThisMonth)} tone={summary.inThisMonth - summary.outThisMonth >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        </div>

        {/* Chart + income/outgoing filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1" role="group" aria-label="Filter chart series">
              {([
                { key: "both", label: "Both" },
                { key: "income", label: "Income" },
                { key: "outgoing", label: "Outgoing" },
              ] as { key: SeriesFilter; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  aria-pressed={seriesFilter === f.key}
                  onClick={() => setSeriesFilter(f.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                    seriesFilter === f.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {seriesFilter !== "outgoing" && (
                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /> {fmt(chartTotals.income)}</span>
              )}
              {seriesFilter !== "income" && (
                <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-500" /> {fmt(chartTotals.outgoing)}</span>
              )}
            </div>
          </div>

          {chartTotals.income === 0 && chartTotals.outgoing === 0 ? (
            <div className="h-40 flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              No money movement in this range yet
            </div>
          ) : (
            <div role="img" aria-label={`Income ${fmt(chartTotals.income)}, outgoing ${fmt(chartTotals.outgoing)}, over the last ${range}`}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    formatter={(value: number, name: string) => [fmt(value), name === "income" ? "Income" : "Outgoing"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                  />
                  {seriesFilter !== "outgoing" && (
                    <Area type="monotone" dataKey="income" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.15)" strokeWidth={2} isAnimationActive={false} />
                  )}
                  {seriesFilter !== "income" && (
                    <Area type="monotone" dataKey="outgoing" stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60% / 0.12)" strokeWidth={2} isAnimationActive={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* This week, in money — folded-in insights */}
        {insights.length > 0 && (
          <div className="pt-3 border-t border-border/60">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Your week, in money
            </p>
            <ul className="space-y-1.5">
              {insights.map((ins, i) => {
                const Icon = ins.icon;
                const toneClr = ins.tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ins.tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", toneClr)} />
                    <span className="text-foreground">{ins.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => navigate("/payment-history")}>
          View all transactions →
        </Button>
      </CardContent>
    </Card>
  );
}

function Tile({
  label,
  value,
  subtitle,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone: "positive" | "negative" | "warn" | "neutral";
  icon: typeof TrendingUp;
}) {
  const toneClasses = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-red-600 dark:text-red-400",
    warn: "text-amber-600 dark:text-amber-400",
    neutral: "text-foreground",
  }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={cn("h-3.5 w-3.5", toneClasses)} />
      </div>
      <p className={cn("text-lg sm:text-xl font-bold truncate", toneClasses)}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default KrePayDashboard;
