import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { Briefcase, CheckCircle2, UserPlus, ArrowRight } from "lucide-react";
import { KretopiaSpinner, KretopiaLoader } from "@/components/brand/KretopiaLoader";

/** What claim_scouted_opportunity says when it did not claim, in words a person can act on. */
const CLAIM_FAILURE: Record<string, string> = {
  not_available: "Someone else claimed this gig first.",
  invalid_token: "This claim link is not valid. Ask for a new one.",
};

interface ClaimResult {
  claimed?: boolean;
  reason?: string;
  opportunity_id?: string;
}

const ClaimGig = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [opportunity, setOpportunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  // The token is the only key: it is not readable from the table (it is the
  // secret in the claim link), so the card is fetched by a function that takes it.
  const loadOpportunity = useCallback(async () => {
    if (!token) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in the generated types yet (same as ClaimEvent)
    const { data, error } = await supabase.rpc("get_scouted_opportunity_by_token" as any, { p_token: token });
    if (error) console.error(error);
    const row = Array.isArray(data) ? data[0] : data;
    setOpportunity(row ?? null);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadOpportunity();
  }, [loadOpportunity]);

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
    // One atomic call: it claims for the signed-in caller or says why not. A
    // claim that changed nothing is never reported as success.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in the generated types yet (same as ClaimEvent)
    const { data, error } = await supabase.rpc("claim_scouted_opportunity" as any, { p_token: token });
    const result = (data ?? null) as ClaimResult | null;

    if (error) {
      toast({ title: "Claim failed", description: error.message, variant: "destructive" });
    } else if (!result?.claimed || !result.opportunity_id) {
      toast({
        title: "Couldn't claim this gig",
        description: CLAIM_FAILURE[result?.reason ?? ""] ?? "It may no longer be available.",
        variant: "destructive",
      });
      // Show the truth on the page too: it now reads "This gig has been claimed".
      if (result?.reason === "not_available") await loadOpportunity();
    } else {
      toast({ title: "Gig claimed!", description: "You now own this listing. Share it to get applications!" });

      // Tell the scout. The function itself ignores a gig with no scout, or one the claimer scouted.
      const { data: claimerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      await supabase.rpc("notify_scout_event", {
        _opportunity_id: result.opportunity_id,
        _event: "claimed",
        _actor_name: claimerProfile?.full_name || "Someone",
      });

      navigate(`/opportunity/${result.opportunity_id}`);
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Briefcase className="mx-auto mb-4 h-16 w-16 animate-pulse text-primary" />
          <KretopiaLoader size="sm" label="Loading gig..." />
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
                <KretopiaSpinner className="h-5 w-5" />
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
