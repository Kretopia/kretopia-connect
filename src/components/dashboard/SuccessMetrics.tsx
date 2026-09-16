import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  Users, 
  Target, 
  Repeat, 
  Zap,
  Calendar
} from "lucide-react";

interface Metrics {
  activationRate: number;
  dailyActiveUsers: number;
  totalUsers: number;
  matchRate: number;
  totalMatches: number;
  totalSwipes: number;
  retention: {
    d1: number;
    d7: number;
    d30: number;
  };
}

export function SuccessMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({
    activationRate: 0,
    dailyActiveUsers: 0,
    totalUsers: 0,
    matchRate: 0,
    totalMatches: 0,
    totalSwipes: 0,
    retention: { d1: 0, d7: 0, d30: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      // Total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Activated users (completed profile)
      const { count: activatedUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("avatar_url", "is", null)
        .not("bio", "is", null);

      // Daily Active Users (logged in today)
      const { count: dau } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_active_date", today.toISOString().split("T")[0]);

      // Total swipes (daily swipes sum)
      const { data: swipeData } = await supabase
        .from("profiles")
        .select("daily_swipes");
      
      const totalSwipes = swipeData?.reduce((sum, p) => sum + (p.daily_swipes || 0), 0) || 0;

      // Total matches
      const { count: totalMatches } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Retention calculations
      // D1: Users who logged in yesterday and came back today
      const { count: d1Users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_active_date", yesterday.toISOString().split("T")[0])
        .lt("created_at", yesterday.toISOString());

      // D7: Users created 7 days ago who are still active
      const { count: d7Users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_active_date", weekAgo.toISOString().split("T")[0])
        .lt("created_at", weekAgo.toISOString());

      // D30: Users created 30 days ago who are still active
      const { count: d30Users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_active_date", monthAgo.toISOString().split("T")[0])
        .lt("created_at", monthAgo.toISOString());

      const { count: cohortWeek } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .lt("created_at", weekAgo.toISOString());

      const { count: cohortMonth } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .lt("created_at", monthAgo.toISOString());

      setMetrics({
        activationRate: totalUsers ? (activatedUsers || 0) / totalUsers * 100 : 0,
        dailyActiveUsers: dau || 0,
        totalUsers: totalUsers || 0,
        matchRate: totalSwipes > 0 ? ((totalMatches || 0) / totalSwipes) * 100 : 0,
        totalMatches: totalMatches || 0,
        totalSwipes,
        retention: {
          d1: cohortWeek ? ((d1Users || 0) / cohortWeek) * 100 : 0,
          d7: cohortWeek ? ((d7Users || 0) / cohortWeek) * 100 : 0,
          d30: cohortMonth ? ((d30Users || 0) / cohortMonth) * 100 : 0,
        }
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Platform Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (value: number, target: number, reverse = false) => {
    const status = reverse 
      ? (value < target ? "success" : value < target * 1.5 ? "warning" : "error")
      : (value >= target ? "success" : value >= target * 0.7 ? "warning" : "error");
    
    return (
      <Badge variant={status === "success" ? "default" : status === "warning" ? "secondary" : "destructive"}>
        {reverse ? (value < target ? "Healthy" : "Needs Attention") : (value >= target ? "On Track" : "Below Target")}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Platform Success Metrics
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Track key performance indicators for platform health
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Activation Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium">Activation Rate</span>
            </div>
            {getStatusBadge(metrics.activationRate, 60)}
          </div>
          <Progress value={metrics.activationRate} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {metrics.activationRate.toFixed(1)}% of users completed their profile (Target: 60%)
          </p>
        </div>

        {/* Daily Active Users */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">Daily Active Users</span>
            </div>
            <Badge variant="outline">
              {metrics.dailyActiveUsers} / {metrics.totalUsers}
            </Badge>
          </div>
          <Progress 
            value={metrics.totalUsers > 0 ? (metrics.dailyActiveUsers / metrics.totalUsers) * 100 : 0} 
            className="h-2" 
          />
          <p className="text-sm text-muted-foreground">
            {((metrics.dailyActiveUsers / metrics.totalUsers) * 100).toFixed(1)}% DAU rate (Target: 30%)
          </p>
        </div>

        {/* Match Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">Match Rate</span>
            </div>
            {getStatusBadge(metrics.matchRate, 20)}
          </div>
          <Progress value={metrics.matchRate} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {metrics.matchRate.toFixed(1)}% of swipes result in matches (Target: 20%)
          </p>
          <p className="text-xs text-muted-foreground">
            {metrics.totalMatches} matches from {metrics.totalSwipes} swipes
          </p>
        </div>

        {/* Retention */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            <span className="font-medium">User Retention</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Day 1 Retention</span>
              <span className="font-medium">{metrics.retention.d1.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.retention.d1} className="h-1.5" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Day 7 Retention</span>
              <span className="font-medium">{metrics.retention.d7.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.retention.d7} className="h-1.5" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Day 30 Retention</span>
              <span className="font-medium">{metrics.retention.d30.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.retention.d30} className="h-1.5" />
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Week 1 Targets</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Activation Rate: 60%+</li>
                <li>• DAU: 30%+ of users active daily</li>
                <li>• Match Rate: 20%+ swipes → matches</li>
                <li>• D1 Retention: 50%+ come back next day</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
