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
  ChevronDown,
} from "lucide-react";
import {
  buildCashFlow,
  currenciesFor,
  currencyOf,
  type CashFlowExpense,
  type CashFlowInvoice,
  type CashFlowRange,
} from "@/lib/krePayCashFlow";

type SeriesFilter = "both" | "income" | "outgoing";

interface KrePayDashboardProps {
  connectBalance?: { available: number; pending: number; currency: string } | null;
}

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
export function KrePayDashboard({ connectBalance = null }: KrePayDashboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [invoices, setInvoices] = useState<CashFlowInvoice[]>([]);
  const [expenses, setExpenses] = useState<CashFlowExpense[]>([]);
  const [range, setRange] = useState<CashFlowRange>("30d");
  const [seriesFilter, setSeriesFilter] = useState<SeriesFilter>("both");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const cols = "total_amount,amount,currency,status,paid_at,due_date,created_at,issued_by,issued_to";
    setLoading(true);
    setError(false);
    void Promise.all([
      supabase.from("invoices").select(cols).eq("issued_by", user.id),
      supabase.from("expenses").select("amount,currency,category,date").eq("user_id", user.id),
    ])
      .then(([invoiceResult, expenseResult]) => {
        if (cancelled) return;
        if (invoiceResult.error) throw invoiceResult.error;
        if (expenseResult.error) throw expenseResult.error;
        setInvoices((invoiceResult.data ?? []) as CashFlowInvoice[]);
        setExpenses((expenseResult.data ?? []) as CashFlowExpense[]);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        console.error("[KrePayDashboard] load", cause);
        setError(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id, retryKey]);

  const currencies = useMemo(() => currenciesFor(invoices, expenses), [invoices, expenses]);
  const activeCurrency = currencies.includes(currency) ? currency : currencies[0] ?? null;
  useEffect(() => {
    if (activeCurrency && activeCurrency !== currency) setCurrency(activeCurrency);
  }, [currencies, currency]);
  const fmt = (n: number, moneyCurrency = activeCurrency) =>
    moneyCurrency ? new Intl.NumberFormat(undefined, { style: "currency", currency: moneyCurrency }).format(n) : "—";

  const summary = useMemo(() => {
    let owedToYou = 0;
    let overdueCount = 0;
    const now = new Date();
    invoices.forEach((i) => {
      if (!activeCurrency || currencyOf(i.currency) !== activeCurrency) return;
      const amt = Number(i.total_amount || i.amount || 0);
      if (i.status !== "paid" && i.status !== "cancelled") {
        owedToYou += amt;
        if (i.due_date && new Date(i.due_date) < now) overdueCount += 1;
      }
    });
    return { owedToYou, overdueCount };
  }, [invoices, activeCurrency]);

  const chartData = useMemo(
    () => activeCurrency ? buildCashFlow(invoices, expenses, activeCurrency, range) : [],
    [invoices, expenses, activeCurrency, range],
  );
  const uncategorizedCount = useMemo(
    () => invoices.filter((row) => currencyOf(row.currency) === null).length + expenses.filter((row) => currencyOf(row.currency) === null).length,
    [invoices, expenses],
  );
  const rangeTotals = useMemo(
    () => chartData.reduce((acc, point) => ({ income: acc.income + point.income, outgoing: acc.outgoing + point.outgoing }), { income: 0, outgoing: 0 }),
    [chartData],
  );

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
        <CardContent className="flex flex-col items-start gap-3 p-6 text-sm text-muted-foreground">
          <p>Couldn't load your money dashboard right now.</p>
          <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Money dashboard</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {currencies.length > 1 && (
              <label className="flex min-h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold">
                Currency
                <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="bg-transparent text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
            )}
            <div className="flex items-center gap-1" role="group" aria-label="Cash-flow date range">
            {(["7d", "30d", "90d"] as CashFlowRange[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
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
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {connectBalance && (
          <section aria-label={`Stripe payout balance in ${connectBalance.currency.toUpperCase()}`}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Stripe payout balance</h3>
              <span className="text-xs text-muted-foreground">{connectBalance.currency.toUpperCase()} · separate from wallet and cash flow</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Available" value={fmt(connectBalance.available, connectBalance.currency.toUpperCase())} tone="positive" icon={TrendingUp} />
              <Tile label="Pending" value={fmt(connectBalance.pending, connectBalance.currency.toUpperCase())} tone="warn" icon={Clock} />
            </div>
          </section>
        )}
        <p className="text-xs text-muted-foreground">
          Invoice and expense activity · {activeCurrency ?? "currency not recorded"} · last {range}
        </p>
        {uncategorizedCount > 0 && (
          <p role="status" className="text-xs text-muted-foreground">
            {uncategorizedCount} record{uncategorizedCount === 1 ? " has" : "s have"} no supported currency and {uncategorizedCount === 1 ? "is" : "are"} excluded from totals.
          </p>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <Tile label={`Income · ${range}`} value={fmt(rangeTotals.income)} tone="positive" icon={TrendingUp} />
          <Tile label={`Outgoing · ${range}`} value={fmt(rangeTotals.outgoing)} tone="negative" icon={TrendingDown} />
          <Tile
            label="Owed to you"
            value={fmt(summary.owedToYou)}
            tone={summary.overdueCount ? "warn" : "neutral"}
            subtitle={summary.overdueCount ? `${summary.overdueCount} overdue` : undefined}
            icon={summary.overdueCount ? AlertCircle : Clock}
          />
          <Tile label={`Net · ${range}`} value={fmt(rangeTotals.income - rangeTotals.outgoing)} tone={rangeTotals.income - rangeTotals.outgoing >= 0 ? "positive" : "negative"} icon={TrendingUp} />
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
                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> {fmt(rangeTotals.income)}</span>
              )}
              {seriesFilter !== "income" && (
                <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-destructive" /> {fmt(rangeTotals.outgoing)}</span>
              )}
            </div>
          </div>

          {rangeTotals.income === 0 && rangeTotals.outgoing === 0 ? (
            <div className="h-40 flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {activeCurrency ? "No recorded money movement in this range." : "No currency-coded money movement is available for this range."}
            </div>
          ) : (
            <div role="img" aria-label={`Income ${fmt(rangeTotals.income)}, outgoing ${fmt(rangeTotals.outgoing)}, over the last ${range}`}>
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
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-foreground">
              View chart data as a table <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-xs">
                <caption className="sr-only">Income and outgoing totals by date, in {activeCurrency ?? "an unspecified currency"}</caption>
                <thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="py-2 pr-3">Date</th><th scope="col" className="py-2 pr-3">Income ({activeCurrency ?? "N/A"})</th><th scope="col" className="py-2">Outgoing ({activeCurrency ?? "N/A"})</th></tr></thead>
                <tbody>{chartData.map((point) => <tr key={point.label} className="border-b border-border/60"><th scope="row" className="py-2 pr-3 font-medium">{point.label}</th><td className="py-2 pr-3">{fmt(point.income)}</td><td className="py-2">{fmt(point.outgoing)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </div>

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
