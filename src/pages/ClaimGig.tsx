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

/**
 * What request_scouted_claim says when it did not open a request, in words a person can act on. The link only ASKS to
 * claim: ownership moves when a Kretopia curator approves the request, never because someone holds the link.
 */
const CLAIM_FAILURE: Record<string, string> = {
  not_available: "This gig was already claimed, or the link is no longer valid.",
  invalid_token: "This claim link is not valid. Ask for a new one.",
  too_many_open: "You already have several claim requests waiting for a decision. Wait for those first.",
};

interface ClaimResult {
  requested?: boolean;
  reason?: string;
  request_id?: string;
}

const ClaimGig = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [opportunity, setOpportunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [requested, setRequested] = useState(false);

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
    // One call opens a REQUEST for the signed-in caller, or says why not. It changes no owner: a curator decides.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in the generated types yet (same as ClaimEvent)
    const { data, error } = await supabase.rpc("request_scouted_claim" as any, { p_kind: "gig", p_token: token });
    const result = (data ?? null) as ClaimResult | null;

    if (error) {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
    } else if (!result?.requested) {
      toast({
        title: "Couldn't send the request",
        description: CLAIM_FAILURE[result?.reason ?? ""] ?? "It may no longer be available.",
        variant: "destructive",
      });
      // Show the truth on the page too: it now reads "This gig has been claimed".
      if (result?.reason === "not_available") await loadOpportunity();
    } else {
      setRequested(true);
      toast({ title: "Request sent", description: "You are not the owner until a Kretopia curator verifies that you publish this gig." });
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
        description={`Ask to manage this gig listing on Kretopia`}
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
              : "Your gig was listed on Kretopia so creatives can discover and apply. Ask to claim it: a Kretopia curator checks that you publish it, then you can manage applicants and fill the role faster."}
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
        {!isClaimed && requested && (
          <div className="rounded-xl border bg-muted/50 p-4 text-sm" role="status">
            <p className="font-semibold">Request received</p>
            <p className="mt-1 text-muted-foreground">A Kretopia curator will check that you publish this gig. You become its owner only when they approve; until then nothing changes on the listing.</p>
          </div>
        )}

        {!isClaimed && !requested && (
          <div className="space-y-3">
            <Button size="lg" className="w-full gap-2" onClick={handleClaim} disabled={claiming}>
              {claiming ? (
                <KretopiaSpinner className="h-5 w-5" />
              ) : user ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              {claiming ? "Sending..." : user ? "Request to claim this gig" : "Sign up & request to claim"}
            </Button>
            {!user && (
              <p className="text-center text-sm text-muted-foreground">
                Create a free account to ask to claim this listing
              </p>
            )}

            <div className="rounded-xl bg-muted/50 p-4 mt-4">
              <h3 className="font-semibold text-sm mb-2">What happens when you ask to claim?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  A Kretopia curator checks that you publish this gig
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  Once they approve, you own the listing and can edit it
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  Then share it to receive applications and manage hires, all in one place
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
