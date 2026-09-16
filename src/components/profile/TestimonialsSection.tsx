import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

interface Review {
  id: string;
  reviewer_name: string;
  reviewer_avatar?: string;
  rating: number;
  review_text: string;
  project_name?: string;
  created_at: string;
}

interface TestimonialsSectionProps {
  reviews: Review[];
  averageRating?: number;
  totalReviews?: number;
}

export const TestimonialsSection = ({ 
  reviews, 
  averageRating = 0,
  totalReviews = 0
}: TestimonialsSectionProps) => {
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={Quote}
        eyebrow="What people say"
        title="Testimonials in the making"
        description="Once your collaborators leave reviews, their words will live here as social proof."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <Card className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1">
            <p className="brand-eyebrow">What people say</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-[-0.02em]">Reviews & Testimonials</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-5 w-5",
                      i < Math.round(averageRating)
                        ? "fill-accent text-accent"
                        : "text-muted"
                    )}
                  />
                ))}
              </div>
              <span className="text-2xl font-bold">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({totalReviews} reviews)</span>
            </div>
          </div>
          
          {/* Rating Distribution - Optional Enhancement */}
          <div className="space-y-2 min-w-[200px]">
            {[5, 4, 3, 2, 1].map(stars => {
              const count = reviews.filter(r => r.rating === stars).length;
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              
              return (
                <div key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-12 text-muted-foreground">{stars} star</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Reviews Grid */}
      <div className="grid gap-4 md:gap-6">
        {reviews.map((review) => (
          <Card 
            key={review.id} 
            className="p-6 space-y-4 hover:shadow-lg transition-shadow"
          >
            {/* Review Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage 
                    src={review.reviewer_avatar} 
                    alt={review.reviewer_name}
                  />
                  <AvatarFallback>
                    {review.reviewer_name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <h4 className="font-semibold">{review.reviewer_name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{new Date(review.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}</span>
                    {review.project_name && (
                      <>
                        <span>•</span>
                        <span>{review.project_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Rating Stars */}
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < review.rating
                        ? "fill-accent text-accent"
                        : "text-muted"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Review Text */}
            <div className="relative">
              <Quote className="absolute -top-2 -left-1 h-8 w-8 text-primary/10" />
              <p className="text-muted-foreground leading-relaxed pl-6">
                {review.review_text}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
