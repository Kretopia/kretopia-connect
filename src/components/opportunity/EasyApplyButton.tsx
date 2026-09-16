import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Loader2, CheckCircle2, MapPin, DollarSign, Briefcase, Image as ImageIcon, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface EasyApplyButtonProps {
  opportunityId: string;
  opportunityTitle: string;
  className?: string;
  size?: "sm" | "default";
}

interface QuickProfile {
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  hourly_rate: number | null;
  project_rate: number | null;
  rate_currency: string | null;
  avg_response_hours: number | null;
}

interface PortfolioItem {
  id: string;
  title: string;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
}

export const EasyApplyButton = ({ opportunityId, opportunityTitle, className, size = "sm" }: EasyApplyButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [profile, setProfile] = useState<QuickProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check if already applied on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from("applications")
      .select("id")
      .eq("applicant_id", user.id)
      .eq("opportunity_id", opportunityId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setApplied(true);
      });
  }, [user, opportunityId]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      sessionStorage.setItem('pending_apply_opportunity', opportunityId);
      navigate(`/auth?redirect=/opportunity/${opportunityId}`);
      return;
    }

    setLoading(true);
    try {
      // Fetch profile and top portfolio in parallel
      const [profileRes, portfolioRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, role, avatar_url, bio, location, hourly_rate, project_rate, rate_currency, avg_response_hours")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("credits")
          .select("id, title, media_url, media_type, thumbnail_url")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      setProfile(profileRes.data as any);
      setPortfolio((portfolioRes.data as any[]) || []);
      setShowPreview(true);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !profile) return;
    setSubmitting(true);

    try {
      const currencySymbol = profile.rate_currency === 'EUR' ? '€' : profile.rate_currency === 'GBP' ? '£' : '$';
      const rateInfo = profile.hourly_rate 
        ? `${currencySymbol}${profile.hourly_rate}/hr` 
        : profile.project_rate 
          ? `From ${currencySymbol}${profile.project_rate}/project`
          : null;

      const coverLetter = [
        `Hi! I'm ${profile.full_name}, a ${profile.role || "creative professional"} based in ${profile.location || "worldwide"}.`,
        note ? `\n\n${note}` : "",
        profile.bio ? `\n\nAbout me: ${profile.bio.slice(0, 300)}` : "",
        rateInfo ? `\n\nRate: ${rateInfo}` : "",
        portfolio.length > 0 ? `\n\nPortfolio: ${portfolio.map(p => p.title).join(", ")}` : "",
      ].join("");

      const portfolioLinks = portfolio
        .filter(p => p.media_url)
        .map(p => p.media_url!);

      // Snapshot model/comp-card data so casting reviews don't depend on later profile edits
      const { data: snap } = await supabase
        .from("profiles")
        .select("model_stats, model_categories, model_unions, mother_agency, comp_card_layout, sub_roles, avatar_url, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const compCardSnapshot = snap && (snap as any).sub_roles?.includes?.("model") ? snap : null;

      const { error } = await supabase.from("applications").insert({
        applicant_id: user.id,
        opportunity_id: opportunityId,
        cover_letter: coverLetter,
        portfolio_links: portfolioLinks.length > 0 ? portfolioLinks : null,
        expected_rate: rateInfo || null,
        status: "pending",
        comp_card_snapshot: compCardSnapshot as any,
      });

      if (error) throw error;

      setApplied(true);
      setShowPreview(false);

      // Notify creator
      const { data: opp } = await supabase
        .from('opportunities')
        .select('created_by, title')
        .eq('id', opportunityId)
        .single();

      if (opp?.created_by) {
        const { notifyOpportunity } = await import("@/lib/pushNotifications");
        await notifyOpportunity(opp.created_by, opp.title, opportunityId);
      }

      toast({
        title: "Applied!",
        description: "Your profile and portfolio have been sent",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (applied) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-500" />
        Applied
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="default"
        size={size}
        className={className}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5 mr-1" />
        )}
        Quick Apply
      </Button>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-primary" />
              Quick Apply
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review what the gig poster will see
            </DialogDescription>
          </DialogHeader>

          {profile && (
            <div className="space-y-4">
              {/* Profile Preview Card */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback>{profile.full_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{profile.full_name || "Your Name"}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile.role || "Creative"}</p>
                  </div>
                  {profile.avg_response_hours != null && profile.avg_response_hours > 0 && (
                    <Badge variant="outline" className="text-[10px] shrink-0 border-primary/40 text-primary bg-primary/5">
                      Fast responder
                    </Badge>
                  )}
                </div>

                {/* Location + Rates */}
                <div className="flex items-center gap-2 flex-wrap">
                  {profile.location && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <MapPin className="h-3 w-3" />
                      {profile.location}
                    </Badge>
                  )}
                  {profile.hourly_rate && (
                    <Badge variant="outline" className="text-[10px] bg-green-500/5 border-green-500/30 text-green-700 dark:text-green-400">
                      <DollarSign className="h-3 w-3" />
                      {profile.rate_currency === 'EUR' ? '€' : profile.rate_currency === 'GBP' ? '£' : '$'}{profile.hourly_rate}/hr
                    </Badge>
                  )}
                  {profile.project_rate && (
                    <Badge variant="outline" className="text-[10px] bg-green-500/5 border-green-500/30 text-green-700 dark:text-green-400">
                      <Briefcase className="h-3 w-3" />
                      From {profile.rate_currency === 'EUR' ? '€' : profile.rate_currency === 'GBP' ? '£' : '$'}{profile.project_rate}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Portfolio Preview */}
              {portfolio.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Top portfolio ({portfolio.length} items)
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {portfolio.map((item) => (
                      <div key={item.id} className="aspect-square rounded-lg overflow-hidden bg-muted border">
                        {(item.thumbnail_url || item.media_url) ? (
                          <img
                            src={item.thumbnail_url || item.media_url || ""}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {portfolio.length === 0 && (
                <div className="text-center py-3 rounded-lg border border-dashed text-xs text-muted-foreground">
                  <ImageIcon className="h-4 w-4 mx-auto mb-1" />
                  No portfolio items yet — add some to your profile!
                </div>
              )}

              {/* Optional Note */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Add a note (optional)</p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why you're a great fit for this gig..."
                  rows={2}
                  maxLength={500}
                  className="text-sm resize-none"
                />
              </div>

              {/* Submit */}
              <Button 
                className="w-full gap-2" 
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Application
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
