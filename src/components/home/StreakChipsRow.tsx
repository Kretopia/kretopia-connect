import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Flame, MessageSquare, UserCircle2, Banknote } from "lucide-react";
import { getStreaks, liveStreakValue, type StreakRow } from "@/lib/streaks";
import { getMoneyStreak } from "@/lib/moneyStreak";
import { cn } from "@/lib/utils";

interface Chip {
  key: string;
  label: string;
  value: number;
  icon: typeof Flame;
}

interface Props {
  className?: string;
}

/**
 * Duolingo-style daily streak chips: Login · Copilot · Profile · Money.
 * Shows even when 0 — the empty state is the nudge.
 */
export function StreakChipsRow({ className }: Props) {
  const { user } = useAuth();
  const [chips, setChips] = useState<Chip[]>([]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    Promise.all([getStreaks(user.id), getMoneyStreak(user.id)])
      .then(([s, money]) => {
        if (!mounted) return;
        const moneyVal = (() => {
          if (!money?.last_action_date) return 0;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const last = new Date(money.last_action_date);
          last.setHours(0, 0, 0, 0);
          const days = Math.floor((today.getTime() - last.getTime()) / 86400000);
          return days <= 1 ? money.current_streak || 0 : 0;
        })();

        setChips([
          { key: "login", label: "Daily", value: liveStreakValue(s.login), icon: Flame },
          { key: "copilot", label: "Copilot", value: liveStreakValue(s.copilot), icon: MessageSquare },
          { key: "profile", label: "Profile", value: liveStreakValue(s.profile_update), icon: UserCircle2 },
          { key: "money", label: "Money", value: moneyVal, icon: Banknote },
        ]);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user || chips.length === 0) return null;
  const totalActive = chips.filter((c) => c.value > 0).length;
  if (totalActive === 0 && chips.every((c) => c.value === 0)) {
    // Don't surface a sea of zeros for brand-new users — wait until they earn one.
    return null;
  }

  return (
    <div className={cn("flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1", className)}>
      {chips.map((c) => {
        const Icon = c.icon;
        const active = c.value > 0;
        return (
          <div
            key={c.key}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors",
              active
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-border/60 bg-muted/40 text-muted-foreground",
            )}
            title={`${c.label} streak: ${c.value} day${c.value === 1 ? "" : "s"}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{c.value}</span>
            <span className="opacity-70 font-medium">{c.label}</span>
          </div>
        );
      })}
    </div>
  );
}
