import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { ProfileCompletionStatus } from "@/lib/profileCompletion";

interface ProfileCompletionProgressProps {
  completion: ProfileCompletionStatus;
  showDetails?: boolean;
}

export const ProfileCompletionProgress = ({ 
  completion, 
  showDetails = true 
}: ProfileCompletionProgressProps) => {
  const getStatusColor = (percentage: number) => {
    if (percentage === 100) return "bg-green-500";
    if (percentage >= 75) return "bg-yellow-500";
    if (percentage >= 50) return "bg-orange-500";
    return "bg-red-500";
  };

  const getStatusMessage = (percentage: number) => {
    if (percentage === 100) return "Your profile is complete and optimized!";
    if (percentage >= 75) return "Almost there! Just a few more fields...";
    if (percentage >= 50) return "You're halfway there! Keep going!";
    return "Let's get your profile started!";
  };

  return (
    <Card className="p-4 border-l-4" style={{ borderLeftColor: `hsl(var(--primary))` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">Profile Completion</h3>
            <Badge variant={completion.percentage === 100 ? "default" : "secondary"}>
              {completion.percentage}%
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {getStatusMessage(completion.percentage)}
          </p>
        </div>
        {completion.percentage === 100 ? (
          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
        ) : (
          <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        )}
      </div>

      <Progress 
        value={completion.percentage} 
        className="h-2 mb-3"
      />

      {showDetails && completion.missingFields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="font-medium">
              {completion.missingFields.length} field{completion.missingFields.length > 1 ? 's' : ''} remaining
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {completion.missingFields.slice(0, 5).map((field) => (
              <span 
                key={field}
                className="text-xs bg-secondary px-2 py-1 rounded-full"
              >
                {field}
              </span>
            ))}
            {completion.missingFields.length > 5 && (
              <span className="text-xs text-muted-foreground px-2 py-1">
                +{completion.missingFields.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {completion.percentage === 100 && (
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
          <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Profile complete! You're now visible in discovery.</span>
          </p>
        </div>
      )}
    </Card>
  );
};