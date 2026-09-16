import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Clock, AlertCircle, ArrowRight, Wallet } from "lucide-react";
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { MoneyStreakChip } from "./MoneyStreakChip";

interface Stats {
  inThisMonth: number;
  outThisMonth: number;
  owedToYou: number;
  owedByYou: number;
  overdueCount: number;
}

interface Props {
  /** "hero" = full 4-tile dashboard for KrePay page; "compact" = Home widget */
  variant?: "hero" | "compact";
  className?: string;
}

export function MoneyBrief({ variant = "hero", className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    inThisMonth: 0,
    outThisMonth: 0,
    owedToYou: 0,
    owedByYou: 0,
    overdueCount: 0,
  });

  useEffect(() => {
    if (!user) return;
    const range = { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };

    const cols = "total_amount,amount,currency,status,paid_at,due_date,created_at,issued_by,issued_to";
    const sb: any = supabase;
    const sentP = sb.from("invoices").select(cols).eq("issued_by", user.id).then((r: any) => r.data as any[] | null);
    const recvP = sb.from("invoices").select(cols).eq("issued_to", user.id).then((r: any) => r.data as any[] | null);

    const expP = sb.from("expenses").select("amount,currency,date").eq("user_id", user.id).then((r: any) => r.data as any[] | null);

    Promise.all([sentP, recvP, expP])
      .then(([sentRaw, recvRaw, expRaw]) => {
        const sent = sentRaw || [];
        const recv = recvRaw || [];
        const expenses = expRaw || [];

        let inMonth = 0;
        let owedTo = 0;
        let overdueCnt = 0;
        const now = new Date();

        sent.forEach((i: any) => {
          const amt = Number(i.total_amount || i.amount || 0);
          if (i.status === "paid" && i.paid_at && isWithinInterval(new Date(i.paid_at), range)) {
            inMonth += amt;
          }
          if (i.status !== "paid" && i.status !== "cancelled") {
            owedTo += amt;
            if (i.due_date && new Date(i.due_date) < now) overdueCnt += 1;
          }
        });

        let owedBy = 0;
        recv.forEach((i: any) => {
          const amt = Number(i.total_amount || i.amount || 0);
          if (i.status !== "paid" && i.status !== "cancelled") owedBy += amt;
        });

        let outMonth = 0;
        expenses.forEach((e: any) => {
          if (e.date && isWithinInterval(new Date(e.date), range)) {
            outMonth += Number(e.amount || 0);
          }
        });

        setStats({
          inThisMonth: inMonth,
          outThisMonth: outMonth,
          owedToYou: owedTo,
          owedByYou: owedBy,
          overdueCount: overdueCnt,
        });
      })
      .catch((err) => console.warn("[MoneyBrief] load failed:", err))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  if (variant === "compact") {
    return (
      <Card
        className={cn(
          "p-4 cursor-pointer hover:border-primary/40 transition-all",
          className
        )}
        onClick={() => navigate("/thrivepay")}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Money this month</p>
              <p className="text-[11px] text-muted-foreground">Tap to open KrePay</p>
            </div>
          </div>
          <MoneyStreakChip />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="In" value={fmt(stats.inThisMonth)} tone="positive" />
          <Tile label="Owed to you" value={fmt(stats.owedToYou)} tone={stats.overdueCount ? "warn" : "neutral"} subtitle={stats.overdueCount ? `${stats.overdueCount} overdue` : undefined} />
        </div>
        <div className="mt-3 flex items-center justify-end text-xs text-primary font-medium">
          Open KrePay <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3", className)}>
      <Tile label="In this month" value={fmt(stats.inThisMonth)} tone="positive" icon={TrendingUp} />
      <Tile label="Out this month" value={fmt(stats.outThisMonth)} tone="negative" icon={TrendingDown} />
      <Tile
        label="Owed to you"
        value={fmt(stats.owedToYou)}
        tone={stats.overdueCount ? "warn" : "neutral"}
        subtitle={stats.overdueCount ? `${stats.overdueCount} overdue` : undefined}
        icon={stats.overdueCount ? AlertCircle : Clock}
      />
      <Tile label="You owe" value={fmt(stats.owedByYou)} tone="neutral" icon={Clock} />
    </div>
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
  icon?: any;
}) {
  const toneClasses = {
    positive: "text-green-600",
    negative: "text-red-600",
    warn: "text-amber-600",
    neutral: "text-foreground",
  }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("h-3.5 w-3.5", toneClasses)} />}
      </div>
      <p className={cn("text-lg sm:text-xl font-bold truncate", toneClasses)}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
