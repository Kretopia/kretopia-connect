import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { validateApplication, sanitizeInput, isValidUrl, handleSupabaseError } from "@/lib/errorHandling";
import { AIOpportunityInsights } from "@/components/discover/AIOpportunityInsights";
import { APP_URL } from "@/lib/constants";

interface ApplyToOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  opportunityTitle: string;
  opportunityDescription?: string;
}

export const ApplyToOpportunityDialog = ({ 
  open, 
  onOpenChange, 
  opportunityId,
  opportunityTitle,
  opportunityDescription 
}: ApplyToOpportunityDialogProps) => {
  const [coverLetter, setCoverLetter] = useState("");
  const [portfolioLink, setPortfolioLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<{ role?: string; bio?: string } | null>(null);
  const { toast } = useToast();

  // Fetch user profile for AI insights
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('role, bio')
        .eq('user_id', user.id)
        .single();
      
      if (data) setUserProfile(data);
    };
    
    if (open) fetchProfile();
  }, [open]);

  const handleSubmit = async () => {
    // Validate inputs
    const portfolioLinksArray = portfolioLink ? [portfolioLink] : [];
    const validationErrors = validateApplication(coverLetter, portfolioLinksArray);
    
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors[0].message,
        variant: "destructive",
      });
      return;
    }

    // Validate URL format if provided
    if (portfolioLink && !isValidUrl(portfolioLink)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to apply",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const sanitizedCoverLetter = sanitizeInput(coverLetter);

    const { data: newApplication, error } = await supabase
      .from('applications')
      .insert({
        opportunity_id: opportunityId,
        applicant_id: user.id,
        cover_letter: sanitizedCoverLetter,
        portfolio_links: portfolioLinksArray,
        status: 'pending',
      })
      .select('id')
      .single();

    setIsSubmitting(false);

    if (error) {
      const appError = handleSupabaseError(error);
      toast({
        title: appError.code === 'DUPLICATE_RECORD' ? "Already applied" : "Error",
        description: appError.message,
        variant: "destructive",
      });
      return;
    }

    // Track opportunity application
    const { analytics } = await import("@/lib/analytics");
    analytics.opportunityApply(opportunityId);

    // Fetch opportunity details + applicant profile for emails
    const [oppRes, profileRes] = await Promise.all([
      supabase.from('opportunities').select('created_by, scouted_by, title').eq('id', opportunityId).single(),
      supabase.from('profiles').select('full_name').eq('user_id', user.id).single(),
    ]);
    const opportunity = oppRes.data;
    const applicantName = profileRes.data?.full_name || 'A creator';
    const gigUrl = `${APP_URL}/opportunity/${opportunityId}`;

    // Send confirmation email to applicant
    supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'application-confirmation',
        recipientEmail: user.email,
        idempotencyKey: `app-confirm-${opportunityId}-${user.id}`,
        templateData: { applicantName, gigTitle: opportunityTitle, gigUrl },
      },
    }).catch(() => {});

    // Notify opportunity creator via email + push
    if (opportunity?.created_by) {
      // Get owner profile for email
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', opportunity.created_by)
        .single();

      // Get owner email from auth (via edge function isn't possible, so use profile)
      // Send notification email to owner (resolved server-side via userId)
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'new-applicant-notification',
          recipientUserId: opportunity.created_by,
          idempotencyKey: `app-notify-${opportunityId}-${user.id}`,
          templateData: {
            ownerName: ownerProfile?.full_name || 'Creator',
            applicantName,
            gigTitle: opportunity.title,
            gigUrl,
          },
        },
      }).catch(() => {});

      // In-app notification for the recruiter: a direct client insert here
      // would be silently rejected by notifications' RLS (INSERT requires
      // auth.uid() = user_id, and the caller is the applicant, not the
      // recruiter) — route it through the validated RPC instead. See
      // HIRE_LOOP_AUDIT.md §3 (same root cause as the accept-side fix) and
      // 20260823150000_hire_loop_notification_fix.sql.
      if (newApplication?.id) {
        supabase.rpc('notify_new_application', { _application_id: newApplication.id })
          .then(() => {}, (err) => console.error('[Apply] notify_new_application failed:', err));
      }

      const { notifyOpportunity } = await import("@/lib/pushNotifications");
      await notifyOpportunity(
        opportunity.created_by,
        opportunity.title,
        opportunityId,
        /* skipInApp */ true
      );
    }

    // Notify the scout (if any) so they can forward the lead to the actual client
    if (opportunity?.scouted_by && opportunity.scouted_by !== opportunity?.created_by && opportunity.scouted_by !== user.id) {
      supabase.rpc('notify_scout_event', {
        _opportunity_id: opportunityId,
        _event: 'applied',
        _actor_name: applicantName,
      }).then(() => {}, (err) => console.warn('[Apply] notify_scout_event failed:', err));
    }

    toast({
      title: "Application submitted!",
      description: "The opportunity creator will review your application",
    });

    onOpenChange(false);
    setCoverLetter("");
    setPortfolioLink("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply to {opportunityTitle}</DialogTitle>
          <DialogDescription>
            Tell them why you're the perfect fit for this opportunity
          </DialogDescription>
        </DialogHeader>

        {/* AI Insights Section */}
        {opportunityDescription && (
          <div className="mb-4">
            <AIOpportunityInsights
              opportunityId={opportunityId}
              opportunityTitle={opportunityTitle}
              opportunityDescription={opportunityDescription}
              userRole={userProfile?.role}
              userBio={userProfile?.bio}
            />
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cover-letter">Cover Letter *</Label>
            <Textarea
              id="cover-letter"
              placeholder="Why are you interested in this opportunity? What makes you a great fit?"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={6}
              maxLength={5000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {coverLetter.length}/5000 characters (minimum 50)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolio">Portfolio Link (Optional)</Label>
            <Input
              id="portfolio"
              type="url"
              placeholder="https://your-portfolio.com"
              value={portfolioLink}
              onChange={(e) => setPortfolioLink(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Application
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
