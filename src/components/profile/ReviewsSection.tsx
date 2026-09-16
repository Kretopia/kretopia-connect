import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, MessageSquarePlus, Award, CheckCircle, XCircle, Link2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";

interface Review {
  id: string;
  reviewer_name: string;
  reviewer_role: string;
  reviewer_company: string;
  reviewer_avatar_url: string;
  rating: number;
  review_text: string;
  project_name: string;
  is_endorsed: boolean;
  is_verified: boolean;
  status: string;
  created_at: string;
}

interface ReviewsSectionProps {
  reviews: Review[];
  isOwnProfile: boolean;
  profileUserId: string;
  onRefresh: () => void;
}

export const ReviewsSection = ({ reviews, isOwnProfile, profileUserId, onRefresh }: ReviewsSectionProps) => {
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    project_name: "",
    personal_message: ""
  });
  const [showCopyTemplate, setShowCopyTemplate] = useState(false);
  const { toast } = useToast();

  const handleRequestReview = async () => {
    try {
      const { data, error } = await supabase
        .from('review_requests')
        .insert({
          profile_id: profileUserId,
          project_name: requestForm.project_name || null,
          personal_message: requestForm.personal_message || null
        })
        .select()
        .single();

      if (error) throw error;

      const reviewLink = `https://www.kretopia.com/submit-review?token=${data.share_token}`;
      
      const copyMessage = `Hi there,

${requestForm.personal_message || "I hope you're doing well! I'm reaching out because your feedback would mean a lot to me."} 

Would you mind taking a few minutes to leave a review about our collaboration${requestForm.project_name ? ` on ${requestForm.project_name}` : ''}? Your insights help me grow and build trust with future clients.

Simply click the link below:
${reviewLink}

Thank you so much!`;

      await navigator.clipboard.writeText(copyMessage);
      setShowCopyTemplate(true);
      
      toast({
        title: "Message copied!",
        description: "Personalized message with review link is ready to share",
      });
      
      setTimeout(() => {
        setIsRequestOpen(false);
        setShowCopyTemplate(false);
        setRequestForm({ project_name: "", personal_message: "" });
        onRefresh();
      }, 3000);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create review request", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (reviewId: string, status: string) => {
    const { error } = await supabase
      .from('reviews')
      .update({ status })
      .eq('id', reviewId);

    if (error) {
      toast({ title: "Error", description: "Failed to update review", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Review ${status}` });
      onRefresh();
    }
  };

  const approvedReviews = reviews.filter(r => r.status === 'approved');
  const pendingReviews = reviews.filter(r => r.status === 'pending');

  if (approvedReviews.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--signal-teal))] font-semibold">Trust</p>
          <h3 className="text-xl md:text-2xl font-black tracking-[-0.02em]">Reviews</h3>
        </div>
        {isOwnProfile && (
          <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" size="sm" className="text-xs md:text-sm">
                <MessageSquarePlus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Request Review</span>
                <span className="sm:hidden">Request</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Request a Review</DialogTitle>
                <DialogDescription>
                  Generate a shareable message with a review link — perfect for email, WhatsApp, or any messaging app
                </DialogDescription>
              </DialogHeader>

              {!showCopyTemplate ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Project Name (Optional)</Label>
                    <Input 
                      placeholder="Brand Campaign 2024"
                      value={requestForm.project_name} 
                      onChange={(e) => setRequestForm({ ...requestForm, project_name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Personal Message (Optional)</Label>
                    <Textarea 
                      placeholder="Add a personal note about why their feedback matters..."
                      value={requestForm.personal_message} 
                      onChange={(e) => setRequestForm({ ...requestForm, personal_message: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleRequestReview} className="w-full" variant="gradient">
                    <Copy className="h-4 w-4 mr-2" />
                    Generate & Copy Message
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    A personalized message with the review link will be copied to your clipboard
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center space-y-4">
                  <CheckCircle className="h-12 w-12 mx-auto text-primary" />
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Message Copied!</h3>
                    <p className="text-sm text-muted-foreground">
                      Paste it in email, WhatsApp, or any messaging app
                    </p>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isOwnProfile && pendingReviews.length > 0 && (
        <div className="rounded-xl md:rounded-2xl border border-accent bg-accent/5 p-3 md:p-4">
          <h4 className="font-semibold mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
            <Star className="h-4 w-4 md:h-5 md:w-5 text-accent" />
            Pending Reviews ({pendingReviews.length})
          </h4>
          <div className="space-y-2 md:space-y-3">
            {pendingReviews.map((review) => (
              <div key={review.id} className="bg-card rounded-lg md:rounded-xl p-3 md:p-4 border border-border">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm md:text-base">{review.reviewer_name}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">{review.reviewer_role}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(review.id, 'approved')} className="text-xs">
                      <CheckCircle className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                      <span className="hidden sm:inline">Approve</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(review.id, 'rejected')} className="text-xs">
                      <XCircle className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                      <span className="hidden sm:inline">Reject</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs md:text-sm">{review.review_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvedReviews.length === 0 ? (
        <EmptyState
          icon={Star}
          eyebrow="Trust"
          title="No reviews yet"
          description="After your next collab wraps, ask a client or collaborator to leave a review — one strong review beats a wall of followers."
        />
      ) : (
        <div className="space-y-3 md:space-y-4">
          {approvedReviews.map((review) => (
            <div key={review.id} className="rounded-xl md:rounded-2xl border border-border bg-card p-4 md:p-6">
              <div className="flex items-start gap-3 md:gap-4">
                {review.reviewer_avatar_url ? (
                  <img
                    src={review.reviewer_avatar_url}
                    alt={review.reviewer_name}
                    className="h-10 w-10 md:h-12 md:w-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm md:text-base font-medium text-muted-foreground">
                      {review.reviewer_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm md:text-base">{review.reviewer_name}</p>
                        {review.is_verified && (
                          <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
                        )}
                        {review.is_endorsed && (
                          <Award className="h-3 w-3 md:h-4 md:w-4 text-accent flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {review.reviewer_role} at {review.reviewer_company}
                      </p>
                      {review.project_name && (
                        <p className="text-xs md:text-sm text-muted-foreground">Project: {review.project_name}</p>
                      )}
                    </div>
                    {review.rating && (
                      <div className="flex gap-0.5 md:gap-1 flex-shrink-0">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3 w-3 md:h-4 md:w-4 ${i < review.rating ? 'fill-accent text-accent' : 'text-muted'}`} />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{review.review_text}</p>
                  <p className="text-xs text-muted-foreground mt-1 md:mt-2">
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
