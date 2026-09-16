import { Star, Shield, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProfileRatingSummaryProps {
  averageRating: number;
  totalReviews: number;
  completedProjects?: number;
  className?: string;
}

export const ProfileRatingSummary = ({
  averageRating,
  totalReviews,
  completedProjects,
  className,
}: ProfileRatingSummaryProps) => {
  if (!averageRating && !totalReviews) return null;

  const rating = averageRating || 0;
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      {/* Star Rating */}
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={cn(
                "h-4 w-4",
                s <= fullStars
                  ? "fill-amber-400 text-amber-400"
                  : s === fullStars + 1 && hasHalf
                  ? "fill-amber-400/50 text-amber-400"
                  : "text-muted-foreground/25"
              )}
            />
          ))}
        </div>
        <span className="text-sm font-bold">{rating.toFixed(1)}</span>
      </div>

      {/* Review Count */}
      {totalReviews > 0 && (
        <Badge variant="outline" className="gap-1 text-xs">
          <MessageSquare className="h-3 w-3" />
          {totalReviews} review{totalReviews !== 1 ? "s" : ""}
        </Badge>
      )}

      {/* Completed Projects */}
      {completedProjects && completedProjects > 0 && (
        <Badge variant="outline" className="gap-1 text-xs">
          <Shield className="h-3 w-3 text-green-500" />
          {completedProjects} completed
        </Badge>
      )}
    </div>
  );
};
