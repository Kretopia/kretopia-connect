import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, DollarSign, MessageSquare, Calendar, Sparkles, ArrowRight, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useRepliesOwed } from "@/hooks/useRepliesOwed";

interface TodayStripProps {
  onVoice: () => void;
  onCommandPalette?: () => void;
  onWrapWeek?: () => void;
}

interface Stats {
  dueToday: number;
  overdue: number;
  pendingInvoices: number;
  pendingAmount: number;
  upcomingCalls: number;
}

/**
 * "Today Strip" — horizontal, snap-scrolling priority bar that sits at the top
 * of /desk. Each chip is a tap-to-act focused action. Mobile-first; on
 * desktop it stretches across the full width and chips become slightly larger.
 *
 * Goal: zero-nav glance — what needs me right now?
 */
export const TodayStrip = ({ onVoice, onCommandPalette, onWrapWeek }: TodayStripProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const repliesOwed = useRepliesOwed();
  const [stats, setStats] = useState<Stats & { weekEarned: number }>({
    dueToday: 0,
    overdue: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    upcomingCalls: 0,
    weekEarned: 0,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);

      const tasksPromise = (supabase as any)
        .from("project_tasks")
        .select("id, due_date, status, assigned_to, created_by")
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
        .neq("status", "done")
        .not("due_date", "is", null)
        .lte("due_date", today)
        .then((r: any) => r, () => ({ data: [] }));

      const invoicesPromise = (supabase as any)
        .from("invoices")
        .select("total_amount, currency, status, paid_at")
        .eq("issued_by", user.id)
        .then((r: any) => r, () => ({ data: [] }));

      const upcomingCallsPromise = (supabase as any)
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", user.id)
        .is("started_at", null)
        .gte("scheduled_for", new Date().toISOString())
        .then((r: any) => r, () => ({ count: 0 }));

      const [tasksRes, invoicesRes, callsRes] = await Promise.all([
        tasksPromise,
        invoicesPromise,
        upcomingCallsPromise,
      ]);

      if (cancelled) return;

      const tasks = (tasksRes as any).data || [];
      const allInvoices = (invoicesRes as any).data || [];
      const upcomingCalls = (callsRes as any).count || 0;
      const pending = allInvoices.filter((i: any) => ["pending", "sent", "overdue"].includes(i.status));
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekEarned = allInvoices
        .filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at).getTime() >= weekAgo)
        .reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0);

      setStats({
        dueToday: tasks.filter((t: any) => t.due_date === today).length,
        overdue: tasks.filter((t: any) => t.due_date < today).length,
        pendingInvoices: pending.length,
        pendingAmount: pending.reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0),
        upcomingCalls,
        weekEarned,
      });
    };

    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const chips: Array<{
    key: string;
    icon: React.ElementType;
    label: string;
    value: string;
    tone: "energy" | "money" | "muted" | "primary";
    onClick: () => void;
  }> = [
    {
      key: "today",
      icon: CheckCircle2,
      label: stats.dueToday + stats.overdue === 0 ? "All clear" : "Due today",
      value:
        stats.overdue > 0
          ? `${stats.overdue} late · ${stats.dueToday} today`
          : `${stats.dueToday}`,
      tone: stats.overdue > 0 ? "energy" : "muted",
      onClick: () => navigate("/desk?focus=tasks"),
    },
    {
      key: "money",
      icon: DollarSign,
      label: "To collect",
      value:
        stats.pendingAmount > 0
          ? `$${Math.round(stats.pendingAmount).toLocaleString()}`
          : "All paid",
      tone: stats.pendingAmount > 0 ? "money" : "muted",
      onClick: () => navigate("/thrivepay?tab=invoices"),
    },
    {
      key: "week",
      icon: DollarSign,
      label: "This week",
      value:
        stats.weekEarned > 0
          ? `+$${Math.round(stats.weekEarned).toLocaleString()}`
          : "$0",
      tone: stats.weekEarned > 0 ? "money" : "muted",
      onClick: () => navigate("/thrivepay"),
    },
    {
      key: "messages",
      icon: MessageSquare,
      label: repliesOwed > 0 ? "Replies owed" : "Threads",
      value: repliesOwed > 0 ? `${repliesOwed}` : "Open",
      tone: repliesOwed > 0 ? "energy" : "muted",
      onClick: () => navigate("/messages"),
    },
    {
      key: "calls",
      icon: Calendar,
      label: stats.upcomingCalls > 0 ? "Upcoming calls" : "Schedule",
      value: stats.upcomingCalls > 0 ? `${stats.upcomingCalls}` : "None set",
      tone: stats.upcomingCalls > 0 ? "energy" : "muted",
      onClick: () => navigate("/calendar"),
    },
    {
      key: "wrap",
      icon: Wand2,
      label: "Wrap week",
      value: "1 tap",
      tone: "primary",
      onClick: () => onWrapWeek?.(),
    },
    {
      key: "cmdk",
      icon: Sparkles,
      label: "Quick jump",
      value: "⌘K",
      tone: "muted",
      onClick: () => onCommandPalette?.(),
    },
  ];

  const toneClass = (tone: string) => {
    switch (tone) {
      case "primary":
        return "bg-primary text-primary-foreground border-primary";
      case "energy":
        return "bg-card border-energy/40 text-foreground";
      case "money":
        return "bg-card border-emerald-500/40 text-foreground";
      default:
        return "bg-card border-border text-foreground";
    }
  };

  return (
    <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
      <div
        className="flex gap-2 sm:gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {chips.map(({ key, icon: Icon, label, value, tone, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={cn(
              "shrink-0 snap-start flex flex-col items-start justify-between",
              "min-w-[136px] sm:min-w-[148px] h-[78px] sm:h-[88px]",
              "rounded-xl border px-3 py-2 text-left",
              "transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
              toneClass(tone)
            )}
          >
            <div className="flex items-center justify-between w-full">
              <Icon className={cn("h-4 w-4", tone === "primary" ? "" : "opacity-70")} />
              <ArrowRight className={cn("h-3 w-3 opacity-40", tone === "primary" && "opacity-70")} />
            </div>
            <div className="w-full">
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider whitespace-nowrap truncate",
                  tone === "primary" ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                {label}
              </p>
              <p className="text-base font-bold leading-tight truncate">{value}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
