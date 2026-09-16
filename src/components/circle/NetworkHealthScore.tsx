import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, Network, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthData {
  diversity_score: number;
  connectivity_score: number;
  growth_potential: number;
  overall_score: number;
  unique_roles: number;
  active_connections: number;
  pending_requests: number;
}

interface NetworkHealthScoreProps {
  className?: string;
  compact?: boolean;
}

export function NetworkHealthScore({ className, compact = false }: NetworkHealthScoreProps) {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchHealthScore();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchHealthScore = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_network_health', {
        p_user_id: user.id
      });

      if (error) {
        console.error('[NetworkHealthScore] Error:', error);
        return;
      }

      if (data && data.length > 0) {
        setHealth(data[0]);
      }
    } catch (err) {
      console.error('[NetworkHealthScore] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  if (loading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!health) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-6 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Build connections to see your network health</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      label: "Diversity",
      score: health.diversity_score,
      icon: Network,
      description: `${health.unique_roles} unique roles`,
    },
    {
      label: "Connectivity",
      score: health.connectivity_score,
      icon: Heart,
      description: `${health.active_connections} active`,
    },
    {
      label: "Growth",
      score: health.growth_potential,
      icon: TrendingUp,
      description: `${health.pending_requests} pending`,
    },
  ];

  if (compact) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Network Health</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-lg font-bold", getScoreColor(health.overall_score))}>
                {health.overall_score}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <Progress value={health.overall_score} className="h-1.5 mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Network Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${(health.overall_score / 100) * 226} 226`}
                className={getScoreColor(health.overall_score)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-xl font-bold", getScoreColor(health.overall_score))}>
                {health.overall_score}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {getScoreLabel(health.overall_score)}
          </p>
        </div>

        {/* Individual Metrics */}
        <div className="space-y-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{metric.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {metric.description}
                    </span>
                    <span className={cn("font-medium", getScoreColor(metric.score))}>
                      {metric.score}
                    </span>
                  </div>
                </div>
                <Progress value={metric.score} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
