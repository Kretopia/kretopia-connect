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
import { Calendar, MapPin, CheckCircle2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const ClaimEvent = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      // Use scouted_by-aware select; this works because RLS lets the scout read
      // their own unclaimed event, and we want anyone with the token to see it
      // even before claim — we'll use a direct query and ignore RLS denial by
      // checking via a public RPC fallback if needed.
      const { data } = await supabase
        .from("creative_jams")
        .select(
          "id, title, description, category, venue_name, venue_address, country, start_time, end_time, cover_image_url, claim_status, scouted_by, created_by, source_platform, source_url"
        )
        .eq("claim_token", token)
        .maybeSingle();

      if (!cancelled) {
        setEvent(data);
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
      const { error } = await supabase
        .from("creative_jams")
        .update({ created_by: user.id, claim_status: "claimed" })
        .eq("claim_token", token)
        .eq("claim_status", "unclaimed");
      if (error) throw error;

      toast({
        title: "Event claimed",
        description: "You're now the host. Edit details, invite guests, and share it.",
      });

      // Notify the scout (if not the same person)
      if (event?.scouted_by && event.scouted_by !== user.id) {
        try {
          const { data: claimer } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", user.id)
            .maybeSingle();
          await supabase.from("notifications").insert({
            user_id: event.scouted_by,
            title: `Your scout was claimed`,
            message: `${claimer?.full_name || "Someone"} claimed "${event.title}" — it's now live on Kretopia.`,
            type: "event_update",
            action_url: `/event/${event.id}`,
          });
        } catch (e) {
          console.warn("scout notify failed (non-fatal)", e);
        }
      }

      navigate(`/events/backstage`);
    } catch (e: any) {
      toast({ title: "Couldn't claim", description: e.message, variant: "destructive" });
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
      <SEO title={`Claim "${event.title}" on Kretopia`} description="Take ownership of your event listing." />
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
              : "A creative spotted your event and listed it on Kretopia so the community can find it. Claim it to take over and manage RSVPs."}
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

        {!isClaimed ? (
          <div className="space-y-3">
            <Button size="lg" className="w-full gap-2" onClick={handleClaim} disabled={claiming}>
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {user ? "Claim this event" : "Sign in to claim"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Claiming makes you the host — you'll be able to edit details, invite guests, message
              attendees, and check people in.
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
