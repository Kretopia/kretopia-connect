import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Calendar, Clock, Users, Check, Ticket, Share2 } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { sendEventConfirmationEmail } from "@/utils/eventConfirmationEmail";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { APP_URL } from "@/lib/constants";
import { eventEntry } from "@/lib/eventEntry";

interface Session {
  id: string;
  title: string;
  description?: string;
  category: string;
  venue_name?: string;
  venue_address?: string;
  start_time: string;
  max_participants: number;
  participant_count: number;
  distance_km?: number;
  creator_name: string;
  creator_avatar?: string;
  created_by: string;
  is_ticketed?: boolean;
  ticket_price?: number;
  ticket_currency?: string;
  external_ticket_url?: string;
  event_type?: string;
  cover_image_url?: string;
}

interface SessionCardProps {
  session: Session;
  userParticipation?: 'going' | 'interested' | 'maybe' | null;
  onJoin?: () => void;
  onClick?: () => void;
}

export const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music', film: 'Film', photo: 'Photo', art: 'Art',
  podcast: '🎙Podcast', workshop: 'Workshop', networking: 'Networking',
  content: 'Content', festival: 'Festival', showcase: 'Showcase',
  general: 'Creative',
};

export const SessionCard = ({ session, userParticipation, onJoin, onClick }: SessionCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [participation, setParticipation] = useState(userParticipation);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in to join events", variant: "destructive" });
      return;
    }
    // Leaving is always allowed. Joining is only direct for a free event: a ticketed
    // one is bought on the event page, and tickets sold elsewhere are sent there.
    if (!participation) {
      const entry = eventEntry(session);
      if (entry.kind === "external") {
        window.open(entry.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (entry.kind === "ticket") {
        if (session.ticket_price && session.ticket_price > 0) {
          toast({ title: "Ticket booking is paused", description: "Native ticket reservations are unavailable until server-side capacity checks are in place.", variant: "destructive" });
          return;
        }
        toast({ title: "This event needs a ticket", description: "Opening the event page to get yours." });
        navigate(`/event/${session.id}`);
        return;
      }
    }
    setLoading(true);
    try {
      if (participation) {
        const { data: result, error } = await supabase.rpc("cancel_event_rsvp", { p_event_id: session.id });
        if (error) throw error;
        if (result === "not_going") throw new Error("Your RSVP could not be found. Refresh and try again.");
        setParticipation(null);
        toast({ title: "Left event" });
      } else {
        const { data: result, error } = await supabase.rpc("rsvp_to_event", { p_event_id: session.id });
        if (error) throw error;
        if (result === "full_no_waitlist") {
          toast({ title: "Event is full", description: "The host hasn't enabled a waitlist for this one.", variant: "destructive" });
          return;
        }
        if (result === "waitlisted") {
          toast({ title: "You're on the waitlist" });
          return;
        }
        if (result !== "joined" && result !== "already") throw new Error("The event did not confirm your RSVP.");
        setParticipation('going');
        toast({ title: result === "already" ? "Already going" : "Joined!" });
        if (result === "joined") {
          const { data: inserted, error: participantError } = await supabase
            .from("jam_participants")
            .select("id")
            .eq("jam_id", session.id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (participantError) throw participantError;
          if (inserted) {
          sendEventConfirmationEmail({
            eventId: session.id,
            eventTitle: session.title,
            startTime: session.start_time,
            venueName: session.venue_name,
            venueAddress: session.venue_address,
            isTicketed: false,
            participantId: inserted.id,
          });
          }
        }
      }
      onJoin?.();
    } catch {
      toast({ title: "Error", description: "Failed to update participation", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${APP_URL}/event/${session.id}`;
    if (navigator.share) {
      navigator.share({ title: session.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied!" });
    }
  };

  const isCreator = user?.id === session.created_by;
  const isFull = session.max_participants > 0 && session.participant_count >= session.max_participants;
  const startDate = new Date(session.start_time);
  const isPast = startDate < new Date();
  const isTicketed = session.is_ticketed && session.ticket_price && session.ticket_price > 0;
  const ticketCurrency = session.ticket_currency;
  const ticketPrice = isTicketed && ticketCurrency && /^[A-Za-z]{3}$/.test(ticketCurrency)
    ? formatTicketPrice(session.ticket_price ?? 0, ticketCurrency)
    : isTicketed ? "Paid ticket · currency unavailable" : session.is_ticketed ? "Ticket options · booking paused" : null;
  const nativeTicketUnavailable = eventEntry(session).kind === "ticket";

  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer group overflow-hidden" onClick={onClick}>
      {/* Cover Image */}
      {session.cover_image_url && (
        <div className="relative h-32 overflow-hidden">
          <img src={session.cover_image_url} alt={session.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs">
            {CATEGORY_LABELS[session.category] || session.category}
          </Badge>
          {ticketPrice && (
            <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs">
              {ticketPrice}
            </Badge>
          )}
        </div>
      )}
      
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <Avatar className="h-9 w-9 ring-2 ring-primary/20 shrink-0">
            <AvatarImage src={session.creator_avatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {session.creator_name?.charAt(0) || 'S'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {session.title}
              </h4>
              {!session.cover_image_url && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {CATEGORY_LABELS[session.category] || session.category}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">by {session.creator_name}</p>
          </div>
        </div>

        {session.description && !session.cover_image_url && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{session.description}</p>
        )}

        <div className="space-y-1.5 mb-3 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{format(startDate, "EEE, MMM d")}</span>
            <Clock className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            <span>{format(startDate, "h:mm a")}</span>
          </div>
          
          {session.venue_name && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{session.venue_name}</span>
              {session.distance_km !== undefined && (
                <Badge variant="outline" className="text-[10px] ml-auto py-0 px-1.5">
                  {session.distance_km < 1 ? `${Math.round(session.distance_km * 1000)}m` : `${session.distance_km.toFixed(1)}km`}
                </Badge>
              )}
            </div>
          )}
          
          {isTicketed && !session.cover_image_url && (
            <div className="flex items-center gap-2">
              <Ticket className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-primary">{ticketPrice}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{session.participant_count}{session.max_participants > 0 ? ` / ${session.max_participants}` : ""} going</span>
            {isFull && <Badge variant="destructive" className="text-[10px] ml-auto py-0 px-1.5">Full</Badge>}
          </div>
        </div>

        <div className="flex gap-2">
          {!isCreator && !isPast && (
            <Button onClick={handleJoin} disabled={loading || nativeTicketUnavailable || (isFull && !participation)}
              variant={participation ? "outline" : "gradient"} size="sm" className="flex-1 text-xs h-8">
              {loading ? <KretopiaSpinner className="h-3.5 w-3.5" /> : participation ? (
                <><Check className="h-3.5 w-3.5 mr-1" /> Going</>
              ) : nativeTicketUnavailable ? (
                "Ticket booking paused"
              ) : eventEntry(session).kind === "external" ? (
                <><Ticket className="h-3.5 w-3.5 mr-1" /> Get tickets</>
              ) : session.is_ticketed ? (
                <><Ticket className="h-3.5 w-3.5 mr-1" /> View ticket options</>
              ) : isFull ? "Full" : "Join"}
            </Button>
          )}
          {isCreator && <Badge variant="secondary" className="flex-1 justify-center text-xs">Hosting</Badge>}
          {isPast && <Badge variant="outline" className="flex-1 justify-center text-xs">Ended</Badge>}
          
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

function formatTicketPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(price);
  } catch {
    return "Paid ticket · currency unavailable";
  }
}
