import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  reviewer_name?: string;
  created_at: string;
}

interface EPKReviewsProps {
  reviews: Review[];
  averageRating?: number;
  totalReviews?: number;
}

export const EPKReviews = ({ reviews, averageRating, totalReviews }: EPKReviewsProps) => {
  if (reviews.length === 0 && !averageRating) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Reviews
      </h3>

      {/* Summary */}
      {averageRating && averageRating > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "h-4 w-4",
                  star <= Math.round(averageRating)
                    ? "text-amber-500 fill-amber-500"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <span className="font-bold text-lg">{averageRating.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground">
            ({totalReviews || reviews.length} review{(totalReviews || reviews.length) !== 1 ? 's' : ''})
          </span>
        </div>
      )}

      {/* Individual reviews */}
      <div className="space-y-3">
        {reviews.slice(0, 5).map((review) => (
          <div key={review.id} className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-3 w-3",
                      star <= review.rating
                        ? "text-amber-500 fill-amber-500"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              {review.reviewer_name && (
                <span className="text-xs font-medium">{review.reviewer_name}</span>
              )}
            </div>
            {review.review_text && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                "{review.review_text}"
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
