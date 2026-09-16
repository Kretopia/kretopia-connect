import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Users, MessageCircle, Briefcase, Check, Flame, CheckCircle2, Circle } from "lucide-react";
import { TooltipHint } from "@/components/ui/tooltip-hint";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// XP system removed — daily goals track completion only

interface DailyGoal {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  xpReward: number;
  completed: boolean;
  current: number;
  target: number;
}

export function DailyGoals() {
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const previousGoalsRef = useRef<DailyGoal[]>([]);

  useEffect(() => {
    fetchDailyProgress();
  }, []);

  // Check for newly completed goals and award XP
  useEffect(() => {
    if (goals.length === 0 || previousGoalsRef.current.length === 0) {
      previousGoalsRef.current = goals;
      return;
    }

    goals.forEach(async (goal) => {
      const previousGoal = previousGoalsRef.current.find((g) => g.id === goal.id);
      
      // If goal just became completed
      if (goal.completed && (!previousGoal || !previousGoal.completed)) {
        switch (goal.id) {
          case 'login':
            // Goals now tracked for completion only, no XP awards
            return;
          case 'swipes':
          case 'post':
          case 'connect':
            break;
          default:
            return;
        }

        toast({
          title: "Daily Goal Complete!",
          description: `${goal.title} completed!`,
        });
      }
    });

    previousGoalsRef.current = goals;
  }, [goals, toast]);

  const fetchDailyProgress = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      // Get profile for streak info
      const { data: profile } = await supabase
        .from("profiles")
        .select("last_active_date, daily_swipes")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) return;

      // Get today's activities
      const { data: todayPosts } = await supabase
        .from("feed_posts")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", `${today}T00:00:00`);

      const { data: todayConnections } = await supabase
        .from("connections")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", `${today}T00:00:00`);

      const dailyGoals: DailyGoal[] = [
        {
          id: "login",
          title: "Daily Login",
          description: "Log in to Kretopia",
          icon: <Flame className="h-4 w-4" />,
          xpReward: 5,
          completed: profile?.last_active_date === today,
          current: profile?.last_active_date === today ? 1 : 0,
          target: 1,
        },
        {
          id: "swipes",
          title: "Discover Creators",
          description: "Swipe on 5 profiles",
          icon: <Target className="h-4 w-4" />,
          xpReward: 10,
          completed: (profile?.daily_swipes || 0) >= 5,
          current: Math.min(profile?.daily_swipes || 0, 5),
          target: 5,
        },
        {
          id: "post",
          title: "Share Your Work",
          description: "Create 1 post",
          icon: <CheckCircle2 className="h-4 w-4" />,
          xpReward: 15,
          completed: (todayPosts?.length || 0) >= 1,
          current: todayPosts?.length || 0,
          target: 1,
        },
        {
          id: "connect",
          title: "Grow Your Network",
          description: "Make 2 connections",
          icon: <Circle className="h-4 w-4" />,
          xpReward: 20,
          completed: (todayConnections?.length || 0) >= 2,
          current: Math.min(todayConnections?.length || 0, 2),
          target: 2,
        },
      ];

      setGoals(dailyGoals);
    } catch (error) {
      console.error("Error fetching daily progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const completedGoals = goals.filter((g) => g.completed).length;
  const totalXP = goals.filter((g) => g.completed).reduce((sum, g) => sum + g.xpReward, 0);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/2"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Daily Goals
            <TooltipHint content="Complete daily goals to earn Thrive Points and maintain your streak. Goals reset every day at midnight!" />
          </h3>
          <p className="text-sm text-muted-foreground">
            {completedGoals}/{goals.length} completed • {totalXP} XP earned
          </p>
        </div>
        <Badge variant={completedGoals === goals.length ? "default" : "secondary"}>
          {Math.round((completedGoals / goals.length) * 100)}%
        </Badge>
      </div>

      <Progress value={(completedGoals / goals.length) * 100} className="mb-4 h-2" />

      <div className="space-y-3">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              goal.completed
                ? "bg-primary/5 border-primary/20"
                : "bg-muted/30 border-border"
            }`}
          >
            <div
              className={`flex-shrink-0 rounded-full p-2 ${
                goal.completed ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {goal.completed ? <CheckCircle2 className="h-4 w-4" /> : goal.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${goal.completed ? "line-through" : ""}`}>
                  {goal.title}
                </p>
                <Badge variant="outline" className="text-xs">
                  +{goal.xpReward} XP
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{goal.description}</p>
              {!goal.completed && (
                <div className="mt-2 flex items-center gap-2">
                  <Progress
                    value={(goal.current / goal.target) * 100}
                    className="h-1 flex-1"
                  />
                  <span className="text-xs text-muted-foreground">
                    {goal.current}/{goal.target}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
