import { Card } from "@/components/ui/card";
import { Flame, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakCalendarProps {
  streakCount: number;
  lastActiveDate: string | null;
}

export function StreakCalendar({ streakCount, lastActiveDate }: StreakCalendarProps) {
  const today = new Date();
  const dayNames = ["M", "T", "W", "T", "F", "S", "S"];

  // Build last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - i));
    const dateStr = date.toISOString().split("T")[0];
    
    // Determine if this day was active based on streak count and last active date
    const lastActive = lastActiveDate ? new Date(lastActiveDate) : null;
    let isActive = false;
    
    if (lastActive && streakCount > 0) {
      const daysDiff = Math.floor((lastActive.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      isActive = daysDiff >= 0 && daysDiff < streakCount;
    }
    
    const isToday = dateStr === today.toISOString().split("T")[0];
    
    return { date, dateStr, isActive, isToday, dayOfWeek: (date.getDay() + 6) % 7 };
  });

  const activeDays = days.filter(d => d.isActive).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">This Week</span>
        </div>
        <span className="text-xs text-muted-foreground">{activeDays}/7 days</span>
      </div>
      
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => (
          <div key={day.dateStr} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-medium">
              {dayNames[day.dayOfWeek]}
            </span>
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                day.isActive && "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30",
                day.isToday && !day.isActive && "border-2 border-primary text-primary",
                !day.isActive && !day.isToday && "bg-muted/50 text-muted-foreground"
              )}
            >
              {day.isActive ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                day.date.getDate()
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
