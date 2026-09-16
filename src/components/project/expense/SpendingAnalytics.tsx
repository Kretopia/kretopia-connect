import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { TrendingDown, Repeat, Receipt, FileCheck } from "lucide-react";
import { getCategoryInfo, EXPENSE_CATEGORIES } from "./ExpenseCategories";

interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  vendor: string | null;
  date: string;
  tax_deductible: boolean;
  is_recurring: boolean;
  payment_method: string | null;
}

interface SpendingAnalyticsProps {
  expenses: Expense[];
  income: number;
}

export function SpendingAnalytics({ expenses, income }: SpendingAnalyticsProps) {
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([cat, total]) => {
        const info = getCategoryInfo(cat);
        return { name: info.label, value: total, color: info.color, icon: info.icon };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const stats = useMemo(() => {
    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const recurring = expenses.filter((e) => e.is_recurring).reduce((s, e) => s + e.amount, 0);
    const taxDeductible = expenses.filter((e) => e.tax_deductible).reduce((s, e) => s + e.amount, 0);
    const profit = income - totalSpent;
    const topVendors: Record<string, number> = {};
    expenses.forEach((e) => {
      if (e.vendor) topVendors[e.vendor] = (topVendors[e.vendor] || 0) + e.amount;
    });
    const sortedVendors = Object.entries(topVendors).sort(([, a], [, b]) => b - a).slice(0, 5);
    return { totalSpent, recurring, taxDeductible, profit, sortedVendors, count: expenses.length };
  }, [expenses, income]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.[0]) {
      const d = payload[0];
      return (
        <div className="bg-popover border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs font-medium">{d.name}</p>
          <p className="text-sm font-bold">${d.value.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">
            {stats.totalSpent > 0 ? ((d.value / stats.totalSpent) * 100).toFixed(1) : 0}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Spent</span>
            </div>
            <p className="text-xl font-bold text-red-600">${stats.totalSpent.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{stats.count} expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit / Loss</span>
            </div>
            <p className={`text-xl font-bold ${stats.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {stats.profit >= 0 ? "+" : ""}${stats.profit.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">Income − Expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Repeat className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recurring</span>
            </div>
            <p className="text-xl font-bold text-amber-600">${stats.recurring.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Monthly commitments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <FileCheck className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tax Deductible</span>
            </div>
            <p className="text-xl font-bold text-green-600">${stats.taxDeductible.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Potential savings</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No expenses yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-xs">{value}</span>}
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Vendors & Category List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Spending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Category bars */}
            {categoryBreakdown.slice(0, 6).map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs flex items-center gap-1.5">
                    {cat.icon} {cat.name}
                  </span>
                  <span className="text-xs font-medium">${cat.value.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${stats.totalSpent > 0 ? (cat.value / stats.totalSpent) * 100 : 0}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Top Vendors */}
            {stats.sortedVendors.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Top Vendors</p>
                {stats.sortedVendors.map(([vendor, amount]) => (
                  <div key={vendor} className="flex justify-between py-1">
                    <span className="text-xs truncate max-w-[150px]">{vendor}</span>
                    <span className="text-xs font-medium">${amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
