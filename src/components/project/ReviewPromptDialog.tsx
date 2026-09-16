import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReviewPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  collaborators: Array<{ id: string; full_name: string; avatar_url: string | null }>;
}

export const ReviewPromptDialog = ({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  collaborators,
}: ReviewPromptDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Find the other collaborator to review
  const reviewTarget = collaborators.find((c) => c.id !== user?.id);

  const handleSubmit = async () => {
    if (!user || !reviewTarget || rating === 0) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("company_reviews").insert({
        company_id: reviewTarget.id,
        reviewer_id: user.id,
        project_id: projectId,
        rating,
        review_text: reviewText || null,
        status: "published",
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Review submitted!",
        description: `Thanks for reviewing your work with ${reviewTarget.full_name}`,
      });

      setTimeout(() => onOpenChange(false), 1500);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!reviewTarget) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project Complete!</DialogTitle>
          <DialogDescription>
            How was your experience working with {reviewTarget.full_name} on "{projectTitle}"?
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2"></div>
            <p className="font-medium">Thanks for your review!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Star Rating */}
            <div>
              <Label className="text-sm">Rating</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition-colors",
                        (hoveredRating || rating) >= star
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Review Text */}
            <div>
              <Label className="text-sm">Review (optional)</Label>
              <Textarea
                placeholder="Share your experience..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>
        )}

        {!submitted && (
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Skip
            </Button>
            <Button onClick={handleSubmit} disabled={rating === 0 || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Submit Review
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
