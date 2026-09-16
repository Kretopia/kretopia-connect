import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Flame, Gift, Sparkles, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";

const DailyCheckIn = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [streak, setStreak] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [todayChecked, setTodayChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [weekDays, setWeekDays] = useState<boolean[]>([false, false, false, false, false, false, false]);

  useEffect(() => {
    if (!user?.id) return;
    fetchCheckInStatus();
  }, [user?.id]);

  const fetchCheckInStatus = async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_streak, last_checkin_date, total_xp")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        const currentStreak = (profile as any).current_streak || 0;
        const lastDate = (profile as any).last_checkin_date;
        const totalXp = (profile as any).total_xp || 0;
        
        setStreak(currentStreak);
        setLastCheckIn(lastDate);
        setXpEarned(totalXp);

        if (lastDate) {
          const last = new Date(lastDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          last.setHours(0, 0, 0, 0);
          setTodayChecked(differenceInCalendarDays(today, last) === 0);

          const days: boolean[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const diff = differenceInCalendarDays(last, d);
            days.push(diff >= 0 && diff < currentStreak && differenceInCalendarDays(d, today) <= 0);
          }
          setWeekDays(days);
        }
      }
    } catch (err) {
      console.error("Error fetching check-in status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!user?.id || todayChecked) return;
    setChecking(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      let newStreak = 1;

      if (lastCheckIn) {
        const diff = differenceInCalendarDays(new Date(), new Date(lastCheckIn));
        if (diff === 1) {
          newStreak = streak + 1;
        } else if (diff === 0) {
          toast({ title: "Already checked in!", description: "Come back tomorrow for your next streak point." });
          setChecking(false);
          return;
        }
      }

      const bonusXP = newStreak >= 7 ? 50 : newStreak >= 3 ? 25 : 10;

      const { error } = await supabase
        .from("profiles")
        .update({
          current_streak: newStreak,
          last_checkin_date: today,
        } as any)
        .eq("user_id", user.id);

      if (error) throw error;

      await supabase.rpc("award_xp" as any, {
        p_user_id: user.id,
        p_amount: bonusXP,
        p_reason: "daily_check_in",
      });

      setStreak(newStreak);
      setTodayChecked(true);
      setXpEarned((prev) => prev + bonusXP);
      setLastCheckIn(today);

      toast({
        title: `Day ${newStreak} streak!`,
        description: `+${bonusXP} XP earned. ${newStreak >= 7 ? "Weekly bonus activated!" : "Keep it going!"}`,
      });
    } catch (err) {
      console.error("Check-in error:", err);
      toast({ title: "Error", description: "Could not check in. Try again.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  if (!user) return <Navigate to="/auth" replace />;

  const streakTier = streak >= 30 ? "Legendary" : streak >= 14 ? "On Fire" : streak >= 7 ? "Hot Streak" : streak >= 3 ? "Warming Up" : "Getting Started";
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="container mx-auto px-4 py-6 max-w-md pb-24 md:pb-6">
      <Helmet>
        <title>Daily Check-In | Kretopia</title>
        <meta name="description" content="Check in daily to build your streak, earn XP, and unlock rewards." />
      </Helmet>

      <div className="text-center mb-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Flame className={cn("h-8 w-8 transition-colors", streak > 0 ? "text-primary" : "text-muted-foreground")} />
        </div>
        <h1 className="text-2xl font-bold">Daily Check-In</h1>
        <p className="text-sm text-muted-foreground mt-1">Show up, earn XP, build momentum</p>
      </div>

      <Card className="mb-4 border-primary/20">
        <CardContent className="pt-6 text-center">
          <div className="text-5xl font-bold text-primary mb-1">{streak}</div>
          <p className="text-sm text-muted-foreground">day streak</p>
          <Badge variant="secondary" className="mt-2 text-xs">{streakTier}</Badge>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between gap-1">
            {weekDays.map((checked, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                    checked
                      ? "bg-primary text-primary-foreground"
                      : i === 6 && !todayChecked
                        ? "border-2 border-primary/50 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {checked ? <CheckCircle className="h-4 w-4" /> : dayLabels[i]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleCheckIn}
        disabled={todayChecked || checking || loading}
        className="w-full h-14 text-lg gap-2"
        variant={todayChecked ? "outline" : "default"}
      >
        {todayChecked ? (
          <>
            <CheckCircle className="h-5 w-5 text-primary" />
            Checked In Today ✓
          </>
        ) : checking ? (
          "Checking in..."
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Check In Now
          </>
        )}
      </Button>

      <Card className="mt-4 bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5" />
            Streak Rewards
          </p>
          <div className="space-y-2 text-sm">
            {[
              { days: 3, xp: 25, label: "3-day streak" },
              { days: 7, xp: 50, label: "7-day streak" },
              { days: 14, xp: 100, label: "14-day streak" },
              { days: 30, xp: 250, label: "30-day streak" },
            ].map((tier) => (
              <div key={tier.days} className="flex items-center justify-between">
                <span className={cn(streak >= tier.days ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {streak >= tier.days ? "" : ""} {tier.label}
                </span>
                <Badge variant="secondary" className="text-[10px]">+{tier.xp} XP</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyCheckIn;
