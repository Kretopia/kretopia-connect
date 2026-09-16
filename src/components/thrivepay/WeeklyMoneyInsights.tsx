import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, Receipt, FileText, AlertCircle } from "lucide-react";
import { startOfWeek, endOfWeek, isWithinInterval, format } from "date-fns";

interface Insight {
  icon: any;
  text: string;
  tone: "positive" | "warn" | "neutral";
}

/**
 * Weekly money insights — shown on KrePay home + Home page.
 * Generated locally from invoice/expense data, no LLM call needed.
 */
export function WeeklyMoneyInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const weekRange = { start: startOfWeek(new Date()), end: endOfWeek(new Date()) };
    const sb: any = supabase;

    Promise.all([
      sb.from("invoices").select("total_amount,amount,currency,status,paid_at,due_date,created_at").eq("issued_by", user.id).then((r: any) => r.data as any[] | null),
      sb.from("expenses").select("amount,category,date").eq("user_id", user.id).then((r: any) => r.data as any[] | null),
    ])
      .then(([invRaw, expRaw]) => {
        const invoices = invRaw || [];
        const expenses = expRaw || [];
        const list: Insight[] = [];

        // 1) Income this week
        const earnedThisWeek = invoices
          .filter((i: any) => i.status === "paid" && i.paid_at && isWithinInterval(new Date(i.paid_at), weekRange))
          .reduce((s: number, i: any) => s + Number(i.total_amount || i.amount || 0), 0);

        if (earnedThisWeek > 0) {
          list.push({
            icon: TrendingUp,
            tone: "positive",
            text: `You earned $${earnedThisWeek.toLocaleString(undefined, { maximumFractionDigits: 0 })} this week`,
          });
        }

        // 2) Overdue invoices
        const overdue = invoices.filter(
          (i: any) => i.status !== "paid" && i.status !== "cancelled" && i.due_date && new Date(i.due_date) < new Date()
        );
        if (overdue.length > 0) {
          const overdueAmt = overdue.reduce((s: number, i: any) => s + Number(i.total_amount || i.amount || 0), 0);
          list.push({
            icon: AlertCircle,
            tone: "warn",
            text: `${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} — $${overdueAmt.toFixed(0)} unpaid`,
          });
        }

        // 3) Top expense category this week
        const expWeek = expenses.filter((e: any) => e.date && isWithinInterval(new Date(e.date), weekRange));
        if (expWeek.length > 0) {
          const byCat: Record<string, number> = {};
          expWeek.forEach((e: any) => {
            const c = e.category || "other";
            byCat[c] = (byCat[c] || 0) + Number(e.amount || 0);
          });
          const top = Object.entries(byCat).sort(([, a], [, b]) => b - a)[0];
          list.push({
            icon: Receipt,
            tone: "neutral",
            text: `Top spend this week: ${top[0]} ($${(top[1] as number).toFixed(0)})`,
          });
        }

        // 4) Invoices sent this week
        const sentThisWeek = invoices.filter((i: any) => isWithinInterval(new Date(i.created_at), weekRange));
        if (sentThisWeek.length > 0) {
          list.push({
            icon: FileText,
            tone: "neutral",
            text: `${sentThisWeek.length} invoice${sentThisWeek.length > 1 ? "s" : ""} sent this week`,
          });
        }

        setInsights(list);
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("[WeeklyInsights] failed:", err);
        setLoaded(true);
      });
  }, [user?.id]);

  if (!loaded || insights.length === 0) return null;

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Your week, in money</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {format(startOfWeek(new Date()), "MMM d")} – {format(endOfWeek(new Date()), "MMM d")}
        </span>
      </div>
      <ul className="space-y-2">
        {insights.map((ins, i) => {
          const Icon = ins.icon;
          const toneClr =
            ins.tone === "positive" ? "text-green-600" :
            ins.tone === "warn" ? "text-amber-600" : "text-muted-foreground";
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${toneClr}`} />
              <span className="text-foreground">{ins.text}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
