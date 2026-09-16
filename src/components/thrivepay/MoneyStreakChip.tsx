import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getMoneyStreak } from "@/lib/moneyStreak";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  variant?: "chip" | "card";
}

/**
 * Tiny streak indicator for KrePay header / Home widget.
 * Shows current daily streak of any money action.
 */
export function MoneyStreakChip({ className, variant = "chip" }: Props) {
  const { user } = useAuth();
  const [streak, setStreak] = useState<number>(0);
  const [longest, setLongest] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    getMoneyStreak(user.id).then((s) => {
      if (!mounted || !s) return;
      // Reset streak in UI if last action wasn't today or yesterday
      const today = new Date();
      const last = s.last_action_date ? new Date(s.last_action_date) : null;
      const days = last ? Math.floor((today.getTime() - last.getTime()) / 86400000) : 999;
      setStreak(days <= 1 ? s.current_streak : 0);
      setLongest(s.longest_streak || 0);
    });

    // Realtime — update when streak changes
    const channel = supabase
      .channel(`money-streak-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "money_streaks", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const row = payload.new;
          if (row) {
            setStreak(row.current_streak || 0);
            setLongest(row.longest_streak || 0);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  if (variant === "card") {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-card p-3 flex items-center gap-3", className)}>
        <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Flame className="h-5 w-5 text-amber-500" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">
            {streak} day{streak === 1 ? "" : "s"}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Money streak{longest > streak ? ` · best ${longest}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        streak > 0
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-border/50 bg-muted text-muted-foreground",
        className
      )}
      title={longest > 0 ? `Longest streak: ${longest} days` : undefined}
    >
      <Flame className="h-3.5 w-3.5" />
      {streak > 0 ? `${streak}-day streak` : "Start your streak"}
    </div>
  );
}
