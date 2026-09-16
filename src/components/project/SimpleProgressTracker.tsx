import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

interface SimpleProgressTrackerProps {
  completedTasks: number;
  totalTasks: number;
  projectStatus: string | null;
}

export const SimpleProgressTracker = ({
  completedTasks,
  totalTasks,
  projectStatus
}: SimpleProgressTrackerProps) => {
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getProgressColor = (pct: number) => {
    if (pct === 100) return 'bg-green-500';
    if (pct >= 50) return 'bg-primary';
    if (pct > 0) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  const getStatusMessage = () => {
    if (projectStatus === 'completed') return 'Project Completed!';
    if (percentage === 100) return 'All tasks completed!';
    if (percentage >= 75) return 'Almost there!';
    if (percentage >= 50) return 'Halfway done!';
    if (percentage > 0) return 'Getting started!';
    return 'Ready to begin';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-semibold">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-3" />
        </div>

        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <p className="text-lg font-medium">{getStatusMessage()}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {completedTasks} of {totalTasks} tasks completed
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
