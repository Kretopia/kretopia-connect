import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Star, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// XP system removed

export default function SubmitReview() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestData, setRequestData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [formData, setFormData] = useState({
    reviewer_name: "",
    reviewer_email: "",
    reviewer_role: "",
    reviewer_company: "",
    review_text: "",
    collaboration_type: ""
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    loadRequestData();
  }, [token]);

  const loadRequestData = async () => {
    try {
      // Fetch review request using secure function (excludes sensitive fields like reviewer_email)
      const { data: request, error: requestError } = await supabase
        .rpc('get_review_request_by_token', { token_param: token })
        .single();

      if (requestError || !request) {
        toast({ title: "Error", description: "Review link not found or expired", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(request.expires_at) < new Date()) {
        toast({ title: "Error", description: "This review link has expired", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Check if already completed
      if (request.status === 'completed') {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      // Fetch profile data (only public fields)
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name, role, bio, avatar_url, location, job_title')
        .eq('user_id', request.profile_id)
        .single();

      setRequestData(request);
      setProfileData(profile);
      // Note: reviewer_email is no longer included in the response for security
      setFormData(prev => ({
        ...prev,
        reviewer_name: request.reviewer_name || ""
      }));
      setLoading(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load review request", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Create the review
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          profile_id: requestData.profile_id,
          reviewer_name: formData.reviewer_name,
          reviewer_email: formData.reviewer_email,
          reviewer_role: formData.reviewer_role,
          reviewer_company: formData.reviewer_company,
          review_text: formData.review_text,
          rating: rating,
          project_name: requestData.project_name || formData.collaboration_type,
          collaboration_type: formData.collaboration_type,
          status: 'pending',
          is_verified: true,
          submission_token: token
        });

      if (reviewError) throw reviewError;

      // Review recorded — status recalculated from metrics automatically

      // Update request status (token-checked server-side; anon UPDATE is closed)
      await (supabase as any).rpc('complete_review_request', { p_token: token });


      setSubmitted(true);
      toast({ title: "Success!", description: "Thank you for your review!" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Review Submitted!</h1>
          <p className="text-muted-foreground">
            Thank you for taking the time to leave a review. Your feedback helps build trust in the creative community.
          </p>
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you a creative? Build your own verified profile!
            </p>
            <Button onClick={() => navigate("/auth")} variant="gradient" className="w-full">
              Join Kretopia
            </Button>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              Learn More
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <h1 className="text-xl font-semibold">Link Not Found</h1>
          <p className="text-muted-foreground">This review link is invalid or has expired.</p>
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm text-muted-foreground">
              Want to build your own verified creative profile?
            </p>
            <Button onClick={() => navigate("/auth")} variant="gradient" className="w-full">
              Join Kretopia
            </Button>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              Learn More
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="container mx-auto max-w-2xl">
        <Card className="p-6 md:p-8 space-y-6">
          {/* Profile Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-border">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profileData.avatar_url} alt={profileData.full_name} />
              <AvatarFallback>
                {profileData.full_name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Leave a Review</h1>
              <p className="text-muted-foreground">
                for <span className="font-semibold text-foreground">{profileData.full_name}</span>
              </p>
              {profileData.role && (
                <p className="text-sm text-muted-foreground">{profileData.role}</p>
              )}
            </div>
          </div>

          {/* Personal Message */}
          {requestData?.personal_message && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <p className="text-sm italic text-muted-foreground">
                "{requestData.personal_message}"
              </p>
            </div>
          )}

          {/* Review Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reviewer_name">Your Name *</Label>
                  <Input
                    id="reviewer_name"
                    required
                    value={formData.reviewer_name}
                    onChange={(e) => setFormData({ ...formData, reviewer_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reviewer_email">Your Email *</Label>
                  <Input
                    id="reviewer_email"
                    type="email"
                    required
                    value={formData.reviewer_email}
                    onChange={(e) => setFormData({ ...formData, reviewer_email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reviewer_role">Your Role</Label>
                  <Input
                    id="reviewer_role"
                    value={formData.reviewer_role}
                    onChange={(e) => setFormData({ ...formData, reviewer_role: e.target.value })}
                    placeholder="Creative Director"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reviewer_company">Company/Organization</Label>
                  <Input
                    id="reviewer_company"
                    value={formData.reviewer_company}
                    onChange={(e) => setFormData({ ...formData, reviewer_company: e.target.value })}
                    placeholder="Company Name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="collaboration_type">Type of Collaboration</Label>
                <Input
                  id="collaboration_type"
                  value={formData.collaboration_type}
                  onChange={(e) => setFormData({ ...formData, collaboration_type: e.target.value })}
                  placeholder="e.g., Brand Campaign, Music Video, Photo Shoot"
                />
              </div>

              <div className="space-y-2">
                <Label>Rating *</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= (hoveredRating || rating)
                            ? 'fill-primary text-primary'
                            : 'text-muted'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review_text">Your Review *</Label>
                <Textarea
                  id="review_text"
                  required
                  rows={6}
                  value={formData.review_text}
                  onChange={(e) => setFormData({ ...formData, review_text: e.target.value })}
                  placeholder="Share your experience working with this creator. What made the collaboration successful?"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full"
              variant="gradient"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Review"
              )}
            </Button>

            <div className="pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground mb-2">
                Are you a creative? Build your own verified profile!
              </p>
              <Button 
                type="button"
                onClick={() => navigate("/auth")} 
                variant="link" 
                className="text-sm"
              >
                Join Kretopia →
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
