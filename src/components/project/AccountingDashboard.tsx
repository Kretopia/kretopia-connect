import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, DollarSign, FileText, Clock,
  CheckCircle2, AlertCircle, Download, ArrowUpRight, ArrowDownLeft,
  PieChart, BarChart3, Calendar, Receipt, ShoppingBag, Store, Users
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { ExpenseForm } from "./expense/ExpenseForm";
import { ExpenseList } from "./expense/ExpenseList";
import { SpendingAnalytics } from "./expense/SpendingAnalytics";
import { AIFinanceInsights } from "./expense/AIFinanceInsights";
import { InvoiceGenerator } from "./InvoiceGenerator";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { CurrencySelector } from "@/components/CurrencySelector";
import { EarningsBreakdownChart } from "@/components/earnings/EarningsBreakdownChart";
import { IncomeGoalTracker } from "@/components/earnings/IncomeGoalTracker";

interface AccountingDashboardProps {
  projectId?: string;
}

export function AccountingDashboard({ projectId }: AccountingDashboardProps) {
  const { user } = useAuth();
  const { preferredCurrency, updatePreferredCurrency, convert, formatAmount, getCurrencySymbol } = useCurrencyConversion();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [marketSales, setMarketSales] = useState<any[]>([]);
  const [marketPurchases, setMarketPurchases] = useState<any[]>([]);
  const [circleRevenue, setCircleRevenue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"this_month" | "last_month" | "last_3" | "last_6" | "year" | "all">("this_month");
  const sym = getCurrencySymbol();

  useEffect(() => {
    if (user) fetchAccountingData();
  }, [user, projectId]);

  // Refresh when SnapReceiptFAB adds a new expense
  useEffect(() => {
    const handler = () => { if (user) fetchAccountingData(); };
    window.addEventListener("thrivepay:expense-added", handler);
    return () => window.removeEventListener("thrivepay:expense-added", handler);
  }, [user]);

  const fetchAccountingData = async () => {
    try {
      let invoiceQuery = supabase.from("invoices").select("*").eq("issued_by", user!.id).order("created_at", { ascending: false });
      if (projectId) invoiceQuery = invoiceQuery.eq("project_id", projectId);

      let paymentQuery = supabase.from("payment_history").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (projectId) paymentQuery = paymentQuery.eq("project_id", projectId);

      let expenseQuery = supabase.from("expenses").select("*").eq("user_id", user!.id).order("date", { ascending: false });
      if (projectId) expenseQuery = expenseQuery.eq("project_id", projectId);

      // Marketplace orders — sales (where user is seller) & purchases (where user is buyer)
      const salesQuery = supabase
        .from("marketplace_orders")
        .select("*, listing:digital_products(title)")
        .eq("seller_id", user!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      const purchasesQuery = supabase
        .from("marketplace_orders")
        .select("*, listing:digital_products(title)")
        .eq("buyer_id", user!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      // Circle subscription revenue (where user owns circles)
      const circleRevenueQuery = supabase
        .from("circle_subscriptions")
        .select("*, circle:spark_rooms(title, created_by)")
        .eq("status", "active");

      const [{ data: invData }, { data: payData }, { data: expData }, { data: salesData }, { data: purchData }, { data: circleData }] = await Promise.all([
        invoiceQuery, paymentQuery, expenseQuery, salesQuery, purchasesQuery, circleRevenueQuery
      ]);

      setInvoices(invData || []);
      setPayments(payData || []);
      setExpenses(expData || []);
      setMarketSales(salesData || []);
      setMarketPurchases(purchData || []);
      // Filter circle revenue to only circles owned by this user
      setCircleRevenue((circleData || []).filter((c: any) => c.circle?.created_by === user!.id));
    } catch (err) {
      console.error("Error loading accounting data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "this_month": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month": return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case "last_3": return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "last_6": return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      case "year": return { start: new Date(now.getFullYear(), 0, 1), end: now };
      default: return null;
    }
  };

  const filteredInvoices = useMemo(() => {
    const range = getDateRange();
    if (!range) return invoices;
    // Include invoices created in period OR paid in period (to catch cross-month payments)
    return invoices.filter(inv => {
      const createdInRange = isWithinInterval(new Date(inv.created_at), { start: range.start, end: range.end });
      const paidInRange = inv.status === "paid" && inv.paid_at && isWithinInterval(new Date(inv.paid_at), { start: range.start, end: range.end });
      return createdInRange || paidInRange;
    });
  }, [invoices, period]);

  const filteredPayments = useMemo(() => {
    const range = getDateRange();
    if (!range) return payments;
    return payments.filter(p => isWithinInterval(new Date(p.created_at), { start: range.start, end: range.end }));
  }, [payments, period]);

  const filteredExpenses = useMemo(() => {
    const range = getDateRange();
    if (!range) return expenses;
    return expenses.filter(e => isWithinInterval(new Date(e.date), { start: range.start, end: range.end }));
  }, [expenses, period]);

  const filteredMarketSales = useMemo(() => {
    const range = getDateRange();
    if (!range) return marketSales;
    return marketSales.filter(o => isWithinInterval(new Date(o.created_at), { start: range.start, end: range.end }));
  }, [marketSales, period]);

  const filteredMarketPurchases = useMemo(() => {
    const range = getDateRange();
    if (!range) return marketPurchases;
    return marketPurchases.filter(o => isWithinInterval(new Date(o.created_at), { start: range.start, end: range.end }));
  }, [marketPurchases, period]);

  const stats = useMemo(() => {
    const totalInvoiced = filteredInvoices.reduce((s, i) => s + convert(Number(i.total_amount || i.amount || 0), i.currency || "USD"), 0);

    // For totalCollected, include ALL paid invoices whose paid_at falls within the period
    // This ensures invoices created in prior months but paid this month are counted
    const range = getDateRange();
    const paidInPeriod = range
      ? invoices.filter(i => i.status === "paid" && i.paid_at && isWithinInterval(new Date(i.paid_at), { start: range.start, end: range.end }))
      : invoices.filter(i => i.status === "paid");
    const totalCollected = paidInPeriod.reduce((s, i) => s + convert(Number(i.total_amount || i.amount || 0), i.currency || "USD"), 0);

    // Outstanding: ALL unpaid invoices regardless of period filter
    const allUnpaidInvoices = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled");
    const overdueInvoices = allUnpaidInvoices.filter(i => i.status === "overdue" || (i.due_date && new Date(i.due_date) < new Date()));
    const overdueAmount = overdueInvoices.reduce((s, i) => s + convert(Number(i.total_amount || i.amount || 0), i.currency || "USD"), 0);
    // Pending = unpaid minus overdue (avoid double-counting)
    const pendingInvoices = allUnpaidInvoices.filter(i => !overdueInvoices.includes(i));
    const pendingAmount = pendingInvoices.reduce((s, i) => s + convert(Number(i.total_amount || i.amount || 0), i.currency || "USD"), 0);
    const received = filteredPayments.filter(p => p.type === "payment_received" && p.status === "completed").reduce((s, p) => s + convert(Number(p.amount), p.currency || "USD"), 0);
    const sent = filteredPayments.filter(p => p.type === "payment_sent" && p.status === "completed").reduce((s, p) => s + convert(Number(p.amount), p.currency || "USD"), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + convert(Number(e.amount), e.currency || "USD"), 0);

    // Marketplace income (seller earnings after platform fee)
    const marketplaceIncome = filteredMarketSales.reduce((s, o) => s + convert(Number(o.amount) - Number(o.platform_fee || 0), "USD"), 0);
    // Marketplace spend (buyer purchases)
    const marketplaceSpend = filteredMarketPurchases.reduce((s, o) => s + convert(Number(o.amount), "USD"), 0);
    
    // Circle subscription revenue
    const circleIncome = circleRevenue.reduce((s, c) => s + convert(Number(c.amount || 0), c.currency || "USD"), 0);

    const totalIncome = totalCollected + marketplaceIncome + circleIncome;
    const totalSpend = totalExpenses + marketplaceSpend;
    // Collection rate: use period-filtered invoiced total vs period-filtered collected
    const collectionRate = totalInvoiced > 0 ? Math.min((totalCollected / totalInvoiced) * 100, 100) : 0;

    return {
      totalInvoiced, totalCollected, overdueAmount, pendingAmount, received, sent, totalExpenses,
      collectionRate, overdueCount: overdueInvoices.length, pendingCount: pendingInvoices.length,
      paidCount: paidInPeriod.length, totalInvoiceCount: filteredInvoices.length,
      marketplaceIncome, marketplaceSpend, totalIncome, totalSpend,
      marketSalesCount: filteredMarketSales.length, marketPurchaseCount: filteredMarketPurchases.length,
      circleIncome, circleSubCount: circleRevenue.length,
    };
  }, [filteredInvoices, filteredPayments, filteredExpenses, filteredMarketSales, filteredMarketPurchases, invoices, circleRevenue, convert]);

  const monthlyRevenue = useMemo(() => {
    const months: Record<string, { invoiced: number; collected: number; payments: number; marketSales: number }> = {};
    
    // Invoiced amounts by created_at month
    filteredInvoices.forEach(inv => {
      const key = format(new Date(inv.created_at), "yyyy-MM");
      if (!months[key]) months[key] = { invoiced: 0, collected: 0, payments: 0, marketSales: 0 };
      months[key].invoiced += convert(Number(inv.total_amount || inv.amount || 0), inv.currency || "USD");
    });
    
    // Collected amounts by paid_at month (not created_at)
    const range = getDateRange();
    const paidInRange = range
      ? invoices.filter(i => i.status === "paid" && i.paid_at && isWithinInterval(new Date(i.paid_at), { start: range.start, end: range.end }))
      : invoices.filter(i => i.status === "paid" && i.paid_at);
    paidInRange.forEach(inv => {
      const key = format(new Date(inv.paid_at), "yyyy-MM");
      if (!months[key]) months[key] = { invoiced: 0, collected: 0, payments: 0, marketSales: 0 };
      months[key].collected += convert(Number(inv.total_amount || inv.amount || 0), inv.currency || "USD");
    });
    
    filteredPayments.forEach(p => {
      if (p.type === "payment_received" && p.status === "completed") {
        const key = format(new Date(p.created_at), "yyyy-MM");
        if (!months[key]) months[key] = { invoiced: 0, collected: 0, payments: 0, marketSales: 0 };
        months[key].payments += convert(Number(p.amount), p.currency || "USD");
      }
    });
    filteredMarketSales.forEach(o => {
      const key = format(new Date(o.created_at), "yyyy-MM");
      if (!months[key]) months[key] = { invoiced: 0, collected: 0, payments: 0, marketSales: 0 };
      months[key].marketSales += convert(Number(o.amount) - Number(o.platform_fee || 0), "USD");
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredInvoices, filteredPayments, filteredMarketSales, invoices, convert]);

  const exportCSV = () => {
    const rows = [
      ["Date", "Type", "Description", "Category", "Status", "Amount", "Currency"],
      ...filteredInvoices.map(inv => [
        format(new Date(inv.created_at), "yyyy-MM-dd"), "Invoice",
        inv.recipient_name || "Client", "", inv.status,
        Number(inv.total_amount || inv.amount || 0).toFixed(2), inv.currency || "USD"
      ]),
      ...filteredPayments.map(p => [
        format(new Date(p.created_at), "yyyy-MM-dd"), p.type,
        p.description || "", "", p.status, Number(p.amount).toFixed(2), p.currency
      ]),
      ...filteredExpenses.map(e => [
        e.date, "Expense", e.title, e.category, e.status,
        `-${Number(e.amount).toFixed(2)}`, e.currency
      ]),
      ...filteredMarketSales.map(o => [
        format(new Date(o.created_at), "yyyy-MM-dd"), "Market Sale",
        o.listing?.title || "Marketplace Sale", "marketplace", "completed",
        (Number(o.amount) - Number(o.platform_fee || 0)).toFixed(2), "USD"
      ]),
      ...filteredMarketPurchases.map(o => [
        format(new Date(o.created_at), "yyyy-MM-dd"), "Market Purchase",
        o.listing?.title || "Marketplace Purchase", "marketplace", "completed",
        `-${Number(o.amount).toFixed(2)}`, "USD"
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Report exported as CSV");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Creative Earnings
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {projectId ? "Project financial overview" : "Your complete financial overview"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <CurrencySelector value={preferredCurrency} onChange={updatePreferredCurrency} compact />
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-32 sm:w-40 h-8 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3">Last 3 Months</SelectItem>
              <SelectItem value="last_6">Last 6 Months</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <ExpenseForm projectId={projectId} onExpenseAdded={fetchAccountingData} />
          <InvoiceGenerator />
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportCSV}>
            <Download className="h-3 w-3" /> <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Primary KPI Row — 4 key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-1 pt-3 px-3 sm:px-4">
            <CardDescription className="text-[10px] uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-primary" /> Total Earned
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <p className="text-xl sm:text-2xl font-bold truncate">{sym}{stats.totalIncome.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Invoices + marketplace + circles ({preferredCurrency})</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-1 pt-3 px-3 sm:px-4">
            <CardDescription className="text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-500" /> Pending
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <p className="text-xl sm:text-2xl font-bold text-amber-600 truncate">{sym}{stats.pendingAmount.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{stats.pendingCount} awaiting payment</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-1 pt-3 px-3 sm:px-4">
            <CardDescription className="text-[10px] uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" /> Outstanding
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <p className="text-xl sm:text-2xl font-bold text-destructive truncate">{sym}{stats.overdueAmount.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{stats.overdueCount} overdue</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${(stats.totalIncome - stats.totalSpend) >= 0 ? 'border-l-green-500' : 'border-l-destructive'}`}>
          <CardHeader className="pb-1 pt-3 px-3 sm:px-4">
            <CardDescription className="text-[10px] uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Net Profit
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <p className={`text-xl sm:text-2xl font-bold truncate ${(stats.totalIncome - stats.totalSpend) >= 0 ? "text-green-600" : "text-destructive"}`}>
              {sym}{(stats.totalIncome - stats.totalSpend).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">Income − expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats — compact row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
          <Store className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{sym}{stats.marketplaceIncome.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">{stats.marketSalesCount} market sales</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
          <Users className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{sym}{stats.circleIncome.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">{stats.circleSubCount} circle subs</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{sym}{stats.totalInvoiced.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">{stats.totalInvoiceCount} invoiced</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
          <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{sym}{stats.totalSpend.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Total spend</p>
          </div>
        </div>
      </div>

      {/* Tabs: Overview / Expenses / Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-9 w-full overflow-x-auto justify-start sm:justify-center">
          <TabsTrigger value="overview" className="text-xs gap-1"><FileText className="h-3 w-3" /> Overview</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs gap-1"><Receipt className="h-3 w-3" /> Expenses</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1"><PieChart className="h-3 w-3" /> Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Earnings Breakdown + Goal Tracker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EarningsBreakdownChart
              invoiceIncome={stats.totalCollected}
              marketplaceIncome={stats.marketplaceIncome}
              paymentIncome={stats.received}
              circleIncome={stats.circleIncome}
              currency={sym}
            />
            <IncomeGoalTracker currentIncome={stats.totalIncome} currencySymbol={sym} />
          </div>

          {/* Monthly Revenue */}
          {monthlyRevenue.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Monthly Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {monthlyRevenue.map(([month, data]) => {
                    const totalMonthIncome = data.collected + data.payments + data.marketSales;
                    const maxVal = Math.max(...monthlyRevenue.map(([, d]) => Math.max(d.invoiced, d.collected + d.payments + d.marketSales)), 1);
                    return (
                      <div key={month} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16 shrink-0 font-mono">
                          {format(new Date(month + "-01"), "MMM yy")}
                        </span>
                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/30 rounded-full relative"
                            style={{ width: `${(Math.max(data.invoiced, totalMonthIncome) / maxVal) * 100}%` }}>
                            <div className="h-full bg-primary rounded-full"
                              style={{ width: Math.max(data.invoiced, totalMonthIncome) > 0 ? `${(totalMonthIncome / Math.max(data.invoiced, totalMonthIncome)) * 100}%` : "0%" }} />
                          </div>
                        </div>
                        <div className="text-right w-24 shrink-0">
                          <p className="text-xs font-medium">{sym}{totalMonthIncome.toFixed(0)}</p>
                          <p className="text-[10px] text-muted-foreground">of {sym}{data.invoiced.toFixed(0)} inv.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-primary inline-block" /> Collected</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-primary/30 inline-block" /> Invoiced</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Transactions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Recent Transactions
              </CardTitle>
              <CardDescription className="text-xs">Invoices, payments, expenses & marketplace</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredInvoices.length === 0 && filteredPayments.length === 0 && filteredExpenses.length === 0 && filteredMarketSales.length === 0 && filteredMarketPurchases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No transactions for this period</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ...filteredInvoices.map(inv => ({
                        date: inv.created_at, type: "invoice" as const,
                        desc: `${inv.invoice_number} — ${inv.recipient_name || "Client"}`,
                        status: inv.status, amount: Number(inv.total_amount || inv.amount || 0),
                        currency: inv.currency || "USD", isIncome: true,
                      })),
                      ...filteredPayments.map(p => ({
                        date: p.created_at, type: p.type as string,
                        desc: p.description || p.type.replace(/_/g, " "),
                        status: p.status, amount: Number(p.amount),
                        currency: p.currency, isIncome: p.type === "payment_received",
                      })),
                      ...filteredExpenses.map(e => ({
                        date: e.date, type: "expense" as const,
                        desc: e.title + (e.vendor ? ` (${e.vendor})` : ""),
                        status: e.status, amount: Number(e.amount),
                        currency: e.currency, isIncome: false,
                      })),
                      ...filteredMarketSales.map(o => ({
                        date: o.created_at, type: "market sale" as const,
                        desc: o.listing?.title || "Marketplace Sale",
                        status: "completed", amount: Number(o.amount) - Number(o.platform_fee || 0),
                        currency: "USD", isIncome: true,
                      })),
                      ...filteredMarketPurchases.map(o => ({
                        date: o.created_at, type: "market purchase" as const,
                        desc: o.listing?.title || "Marketplace Purchase",
                        status: "completed", amount: Number(o.amount),
                        currency: "USD", isIncome: false,
                      }))
                    ]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 25)
                      .map((tx, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(tx.date), "MMM d")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {tx.type === "invoice" ? (
                                <FileText className="h-3 w-3 text-primary" />
                              ) : tx.type === "expense" ? (
                                <Receipt className="h-3 w-3 text-destructive" />
                              ) : tx.type === "market sale" ? (
                                <Store className="h-3 w-3 text-green-500" />
                              ) : tx.type === "market purchase" ? (
                                <ShoppingBag className="h-3 w-3 text-destructive" />
                              ) : tx.isIncome ? (
                                <ArrowDownLeft className="h-3 w-3 text-green-500" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3 text-destructive" />
                              )}
                              <span className="text-xs capitalize">{tx.type.replace(/_/g, " ")}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{tx.desc}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[9px] ${
                              tx.status === "paid" || tx.status === "completed" || tx.status === "confirmed" ? "text-green-600" :
                              tx.status === "overdue" || tx.status === "failed" ? "text-red-600" :
                              "text-muted-foreground"
                            }`}>
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-xs text-right font-medium ${tx.isIncome ? "text-green-600" : "text-red-600"}`}>
                            {tx.isIncome ? "+" : "-"}{formatAmount(tx.amount, tx.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> All Expenses
              </CardTitle>
              <CardDescription className="text-xs">{filteredExpenses.length} expenses in selected period</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ExpenseList expenses={filteredExpenses} onRefresh={fetchAccountingData} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <AIFinanceInsights expenses={filteredExpenses} invoices={filteredInvoices} />
          <SpendingAnalytics expenses={filteredExpenses} income={stats.totalIncome} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
