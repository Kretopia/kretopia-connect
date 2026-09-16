import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, TrendingUp, Receipt, Shield, AlertTriangle,
  Lightbulb, Loader2, DollarSign
} from "lucide-react";
import { toast } from "sonner";

interface Insight {
  title: string;
  insight: string;
  type: "saving" | "tax" | "cashflow" | "growth" | "warning" | "tip";
  priority: "high" | "medium" | "low";
}

interface AIFinanceInsightsProps {
  expenses: any[];
  invoices: any[];
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  saving: { icon: DollarSign, color: "text-green-600", bg: "bg-green-500/10" },
  tax: { icon: Shield, color: "text-primary", bg: "bg-primary/10" },
  cashflow: { icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
  growth: { icon: Sparkles, color: "text-amber-600", bg: "bg-amber-500/10" },
  warning: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-500/10" },
  tip: { icon: Lightbulb, color: "text-primary", bg: "bg-primary/10" },
};

const priorityColors: Record<string, string> = {
  high: "border-red-500/30 text-red-600",
  medium: "border-amber-500/30 text-amber-600",
  low: "border-muted-foreground/30 text-muted-foreground",
};

export function AIFinanceInsights({ expenses, invoices }: AIFinanceInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-finance", {
        body: { action: "insights", expenses, invoices },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInsights(data.insights || []);
      setGenerated(true);
    } catch (err: any) {
      console.error("AI insights error:", err);
      toast.error(err.message || "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  };

  if (!generated) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="pt-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Finance Copilot</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Get personalized insights on spending, tax deductions, and cash flow optimization
            </p>
          </div>
          <Button onClick={generateInsights} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyzing..." : "Generate Insights"}
          </Button>
          {expenses.length === 0 && invoices.length === 0 && (
            <p className="text-[10px] text-muted-foreground">Add some expenses or invoices first for better insights</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Smart Insights
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={generateInsights} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, i) => {
          const config = typeConfig[insight.type] || typeConfig.tip;
          const Icon = config.icon;
          return (
            <div key={i} className={`flex gap-3 p-3 rounded-lg ${config.bg}`}>
              <div className="shrink-0 mt-0.5">
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold">{insight.title}</span>
                  <Badge variant="outline" className={`text-[8px] px-1 py-0 ${priorityColors[insight.priority]}`}>
                    {insight.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{insight.insight}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
