import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { Briefcase, CheckCircle2, UserPlus, ArrowRight, Loader2 } from "lucide-react";

const ClaimGig = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [opportunity, setOpportunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const fetchOpp = async () => {
      if (!token) return;
      const { data, error } = await supabase
        .from("opportunities")
        .select(OPPORTUNITY_PUBLIC_COLUMNS)
        .eq("claim_token", token)
        .maybeSingle();

      if (error) console.error(error);
      setOpportunity(data);
      setLoading(false);
    };
    fetchOpp();
  }, [token]);

  // Auto-claim after signup redirect
  useEffect(() => {
    if (!user || !token) return;
    const pendingClaim = sessionStorage.getItem("pending_claim_token");
    if (pendingClaim === token) {
      sessionStorage.removeItem("pending_claim_token");
      handleClaim();
    }
  }, [user, token]);

  const handleClaim = async () => {
    if (!user) {
      sessionStorage.setItem("pending_claim_token", token!);
      // Send guests through the unified Search → Claim → Email flow
      navigate(
        `/claim?source=gig&gig=${encodeURIComponent(token!)}&redirect=${encodeURIComponent(`/claim-gig/${token}`)}`,
      );
      return;
    }

    if (opportunity?.claim_status === "claimed") {
      toast({ title: "Already claimed", description: "This gig has already been claimed by someone.", variant: "destructive" });
      return;
    }

    setClaiming(true);
    const { error } = await supabase
      .from("opportunities")
      .update({
        created_by: user.id,
        claim_status: "claimed",
      })
      .eq("claim_token", token)
      .eq("claim_status", "unclaimed");

    if (error) {
      toast({ title: "Claim failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gig claimed!", description: "You now own this listing. Share it to get applications!" });

      // Notify the original scout (if any, and not the same person claiming)
      if (opportunity?.scouted_by && opportunity.scouted_by !== user.id) {
        const { data: claimerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const claimerName = claimerProfile?.full_name || "Someone";
        await supabase.rpc("notify_scout_event", {
          _opportunity_id: opportunity.id,
          _event: "claimed",
          _actor_name: claimerName,
        });
      }

      navigate(`/opportunity/${opportunity.id}`);
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Briefcase className="mx-auto mb-4 h-16 w-16 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading gig...</p>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold mb-2">Gig Not Found</h2>
          <p className="text-muted-foreground mb-4">This claim link may be invalid or expired.</p>
          <Button onClick={() => navigate("/")}>Go to Home</Button>
        </div>
      </div>
    );
  }

  const isClaimed = opportunity.claim_status === "claimed";

  return (
    <div className="min-h-screen p-4 md:p-6">
      <SEO
        title={`Claim: ${opportunity.title} — Kretopia`}
        description={`Claim ownership of this gig listing and start receiving applications on Kretopia`}
      />
      <div className="mx-auto max-w-2xl">
        {/* Hero */}
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 mb-6 text-center">
          <div className="text-4xl mb-3"></div>
          <h1 className="text-2xl font-bold mb-2">
            {isClaimed ? "This Gig Has Been Claimed" : "Claim This Gig"}
          </h1>
          <p className="text-muted-foreground">
            {isClaimed
              ? "This listing has already been claimed by its owner."
              : "Your gig was listed on Kretopia so creatives can discover and apply. Claim it to manage applicants, message talent, and fill the role faster."}
          </p>
        </div>

        {/* Gig Preview */}
        <div className="rounded-2xl border bg-card p-6 shadow-card mb-6">
          <Badge className="mb-2">
            {opportunity.type?.charAt(0).toUpperCase() + opportunity.type?.slice(1)}
          </Badge>
          <h2 className="text-xl font-bold mb-3">{opportunity.title}</h2>
          <p className="text-muted-foreground text-sm whitespace-pre-line line-clamp-6">
            {opportunity.description}
          </p>

          {opportunity.compensation && (
            <div className="mt-3 flex items-center gap-2 text-sm text-accent">
              <span></span> {opportunity.compensation}
            </div>
          )}
          {opportunity.location && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span></span> {opportunity.location}
            </div>
          )}

          {opportunity.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {opportunity.tags.map((tag: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        {!isClaimed && (
          <div className="space-y-3">
            <Button size="lg" className="w-full gap-2" onClick={handleClaim} disabled={claiming}>
              {claiming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : user ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              {claiming ? "Claiming..." : user ? "Claim This Gig" : "Sign Up & Claim This Gig"}
            </Button>
            {!user && (
              <p className="text-center text-sm text-muted-foreground">
                Create a free account to claim and manage this listing
              </p>
            )}

            <div className="rounded-xl bg-muted/50 p-4 mt-4">
              <h3 className="font-semibold text-sm mb-2">What happens when you claim?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  You become the owner and can edit the listing
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  Share the link to receive applications from creators
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  Review applicants and manage hires — all in one place
                </li>
              </ul>
            </div>
          </div>
        )}

        {isClaimed && (
          <Button className="w-full" onClick={() => navigate(`/opportunity/${opportunity.id}`)}>
            View Full Listing
          </Button>
        )}
      </div>
    </div>
  );
};

export default ClaimGig;
