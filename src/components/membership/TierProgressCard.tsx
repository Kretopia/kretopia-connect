import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Star } from "lucide-react";
import { calculateStatusFromCredits, type StatusResult } from "@/lib/statusEngine";

interface TierProgressCardProps {
  currentPoints: number;
}

export const TierProgressCard = ({ currentPoints }: TierProgressCardProps) => {
  // Convert legacy points to a rough credit count for status calculation
  const estimatedCredits = Math.floor(currentPoints / 10);
  const status = calculateStatusFromCredits(
    Array.from({ length: estimatedCredits }, () => ({ verification_status: "manual" }))
  );

  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${status.gradient} border-2`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div>
              <h3 className="text-xl font-bold">{status.label}</h3>
              <p className="text-sm text-muted-foreground">Current Status</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
            <Star className="h-3 w-3 mr-1" />
            {status.metrics.totalCredits} credits
          </Badge>
        </div>

        {status.nextTier && status.progress.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress to {status.nextTier.charAt(0).toUpperCase() + status.nextTier.slice(1)}</span>
              <span className="font-semibold">+{status.progress[0].needed - status.progress[0].current} {status.progress[0].label.toLowerCase()}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${Math.min(100, (status.progress[0].current / status.progress[0].needed) * 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>{Math.round((status.progress[0].current / status.progress[0].needed) * 100)}% complete</span>
            </div>
          </div>
        )}

        {!status.nextTier && (
          <div className="text-center py-2">
            <Badge className="bg-accent/20 text-accent border-accent/30">
              Highest Status Achieved!
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
};
