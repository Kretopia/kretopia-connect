import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Link2, Network, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface NetworkReachStatsProps {
  stats: {
    degree1: number;
    degree2: number;
    degree3: number;
    totalReach: number;
  };
  loading?: boolean;
  className?: string;
  onDegreeClick?: (degree: number) => void;
}

export function NetworkReachStats({ stats, loading, className, onDegreeClick }: NetworkReachStatsProps) {
  if (loading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
      </Card>
    );
  }

  const degrees = [
    {
      degree: 1,
      label: "1st Degree",
      sublabel: "Direct connections",
      count: stats.degree1,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20"
    },
    {
      degree: 2,
      label: "2nd Degree",
      sublabel: "Friends of friends",
      count: stats.degree2,
      icon: Link2,
      color: "text-secondary-foreground",
      bgColor: "bg-secondary/60",
      borderColor: "border-secondary/40"
    },
    {
      degree: 3,
      label: "3rd Degree",
      sublabel: "Extended network",
      count: stats.degree3,
      icon: Network,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      borderColor: "border-muted-foreground/20"
    }
  ];

  return (
    <Card className={cn("p-4 bg-gradient-to-br from-background to-muted/20", className)}>
      {/* Header with total reach */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Your Network Reach</h3>
            <p className="text-xs text-muted-foreground">Creators within 3 degrees</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{stats.totalReach.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Reach</p>
        </div>
      </div>

      {/* Degree breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {degrees.map((deg) => {
          const Icon = deg.icon;
          return (
            <button
              key={deg.degree}
              onClick={() => onDegreeClick?.(deg.degree)}
              className={cn(
                "p-3 rounded-lg border transition-all text-left",
                "hover:scale-[1.02] hover:shadow-md active:scale-[0.98] cursor-pointer",
                deg.bgColor,
                deg.borderColor
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn("h-3.5 w-3.5", deg.color)} />
                <span className={cn("text-xs font-medium", deg.color)}>{deg.label}</span>
              </div>
              <p className="text-xl font-bold leading-none mb-1">{deg.count.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{deg.sublabel}</p>
              {deg.count > 0 && (
                <span className="mt-1.5 inline-block text-[10px] text-primary font-medium">View →</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Visual bar representation */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
            {stats.totalReach > 0 && (
              <>
                <div 
                  className="h-full bg-primary transition-all" 
                  style={{ width: `${(stats.degree1 / stats.totalReach) * 100}%` }}
                />
                <div 
                  className="h-full bg-accent transition-all" 
                  style={{ width: `${(stats.degree2 / stats.totalReach) * 100}%` }}
                />
                <div 
                  className="h-full bg-muted-foreground/50 transition-all" 
                  style={{ width: `${(stats.degree3 / stats.totalReach) * 100}%` }}
                />
              </>
            )}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Inner Circle</span>
          <span>Extended Network</span>
        </div>
      </div>
    </Card>
  );
}
