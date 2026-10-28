import { useEffect, useState } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { Calendar, MapPin, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { format } from "date-fns";

const ClaimEvent = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      // The token is the only key: the card comes from get_scouted_event_by_token,
      // so unclaimed events and their tokens are no longer listable by anyone.
      const { data } = await supabase.rpc("get_scouted_event_by_token" as any, { p_token: token });
      const row = Array.isArray(data) ? data[0] : data;

      if (!cancelled) {
        setEvent(row ?? null);
        setLoading(false);
      }
    })().catch((e) => {
      console.error("[ClaimEvent] fetch failed", e);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Auto-claim after sign in
  useEffect(() => {
    if (!user || !token) return;
    const pending = sessionStorage.getItem("pending_event_claim_token");
    if (pending === token) {
      sessionStorage.removeItem("pending_event_claim_token");
      handleClaim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const handleClaim = async () => {
    if (!token) return;
    if (!user) {
      sessionStorage.setItem("pending_event_claim_token", token);
      navigate(`/auth?redirect=${encodeURIComponent(`/claim-event/${token}`)}`);
      return;
    }
    if (event?.claim_status === "claimed") {
      toast({ title: "Already claimed", description: "This event already has a host." });
      navigate(`/event/${event.id}`);
      return;
    }

    setClaiming(true);
    try {
      // The link only opens a REQUEST for this person; a Kretopia curator decides who hosts. Success is reported only
      // when a request really exists, and it is never described as ownership.
      const { data: res, error } = await supabase.rpc("request_scouted_claim" as any, { p_kind: "event", p_token: token });
      if (error) throw error;
      const result = (res ?? null) as { requested?: boolean; reason?: string } | null;
      if (!result?.requested) {
        toast({
          title: "Couldn't send the request",
          description:
            result?.reason === "too_many_open"
              ? "You already have several claim requests waiting for a decision. Wait for those first."
              : "It may already have a host, or the link is no longer valid.",
          variant: "destructive",
        });
        return;
      }

      setRequested(true);
      toast({
        title: "Request sent",
        description: "You are not the host until a Kretopia curator verifies that you organise this event.",
      });
    } catch (e: any) {
      toast({ title: "Request failed", description: e.message, variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">Claim link not found</h1>
            <p className="text-sm text-muted-foreground">
              This claim link is invalid or has been removed. If you're an event host expecting one,
              ask the person who scouted it to send a fresh link.
            </p>
            <Button variant="outline" onClick={() => navigate("/events")}>
              Browse events
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isClaimed = event.claim_status === "claimed";
  const dateStr = event.start_time
    ? format(new Date(event.start_time), "EEE, MMM d · h:mm a")
    : "Date TBD";

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`Claim "${event.title}" on Kretopia`} description="Ask to host your event listing." />
      <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <Badge variant={isClaimed ? "secondary" : "outline"} className="mb-2">
            {isClaimed ? "Already claimed" : "Scouted · awaiting host"}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {isClaimed ? "This event is live" : "Are you the host?"}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isClaimed
              ? "Someone already claimed this event. View it below."
              : "A creative spotted your event and listed it on Kretopia so the community can find it. Ask to claim it: a Kretopia curator checks that you organise it, then you can manage RSVPs."}
          </p>
        </div>

        <Card className="overflow-hidden">
          {event.cover_image_url && (
            <img src={event.cover_image_url} alt={event.title} className="w-full h-48 object-cover" />
          )}
          <CardContent className="p-5 space-y-3">
            <h2 className="text-xl font-bold">{event.title}</h2>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {dateStr}
              </span>
              {(event.venue_name || event.venue_address) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.venue_name || event.venue_address}
                </span>
              )}
            </div>
            {event.description && (
              <p className="text-sm whitespace-pre-wrap text-foreground/80">{event.description}</p>
            )}
            {event.source_url && (
              <p className="text-xs text-muted-foreground">
                Source: <a href={event.source_url} target="_blank" rel="noreferrer" className="underline">{event.source_url}</a>
              </p>
            )}
          </CardContent>
        </Card>

        {!isClaimed && requested ? (
          <div className="rounded-xl border bg-muted/50 p-4 text-sm" role="status">
            <p className="font-semibold">Request received</p>
            <p className="mt-1 text-muted-foreground">A Kretopia curator will check that you organise this event. You become its host only when they approve; until then nothing changes on the listing.</p>
          </div>
        ) : !isClaimed ? (
          <div className="space-y-3">
            <Button size="lg" className="w-full gap-2" onClick={handleClaim} disabled={claiming}>
              {claiming ? <KretopiaSpinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {user ? "Request to claim this event" : "Sign in to request"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              A curator checks that you organise this event. Once they approve, you're the host: edit details,
              invite guests, message attendees, and check people in.
            </p>
          </div>
        ) : (
          <Button size="lg" className="w-full gap-2" onClick={() => navigate(`/event/${event.id}`)}>
            View event <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ClaimEvent;
