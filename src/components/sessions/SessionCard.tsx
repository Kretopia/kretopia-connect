import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Users, Share2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { sendEventConfirmationEmail } from "@/utils/eventConfirmationEmail";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { APP_URL } from "@/lib/constants";
import { eventEntry } from "@/lib/eventEntry";
import { CardRow } from "@/components/cards/CardRow";
import { CardPill } from "@/components/cards/CardShell";
import { CARD_ICON_BTN } from "@/components/cards/cardTokens";
import { EventCard } from "@/components/circle/EventCard";

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
  /** A row, for a list that sits beside other rows (the map's sidebar, the Nearby list). Without it, the card, for a grid of events. */
  compact?: boolean;
}

export const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music', film: 'Film', photo: 'Photo', art: 'Art',
  podcast: '🎙Podcast', workshop: 'Workshop', networking: 'Networking',
  content: 'Content', festival: 'Festival', showcase: 'Showcase',
  general: 'Creative',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', IDR: 'Rp', TTD: 'TT$',
};

/**
 * An event or session, as the shared card (the event variant, for a grid) or as a row of it (for a list beside other rows). Both say the same
 * things and do the same things: join (a free event), leave, get a ticket, open the page where tickets are sold, share. The card or row opens
 * the event, and joining, getting a ticket and sharing never open it.
 */
export const SessionCard = ({ session, userParticipation, onJoin, onClick, compact = false }: SessionCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [participation, setParticipation] = useState(userParticipation);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
        toast({ title: "This event needs a ticket", description: "Opening the event page to get yours." });
        navigate(`/event/${session.id}`);
        return;
      }
    }
    setLoading(true);
    try {
      if (participation) {
        await supabase.from('jam_participants').delete().eq('jam_id', session.id).eq('user_id', user.id);
        setParticipation(null);
        toast({ title: "Left event" });
      } else {
        const { data: inserted } = await supabase.from('jam_participants').insert({ jam_id: session.id, user_id: user.id, status: 'going' }).select('id').single();
        setParticipation('going');
        toast({ title: "Joined!" });
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
  const isFull = session.participant_count >= session.max_participants;
  const startDate = new Date(session.start_time);
  const isPast = startDate < new Date();
  const isTicketed = session.is_ticketed && session.ticket_price && session.ticket_price > 0;
  const currencySymbol = CURRENCY_SYMBOLS[session.ticket_currency || 'USD'] || '$';

  const kind = CATEGORY_LABELS[session.category] || session.category;
  const when = format(startDate, "EEE, MMM d · h:mm a");
  const attendance = `${session.participant_count}/${session.max_participants}${isFull ? " · Full" : ""}`;
  const distance = session.distance_km === undefined ? null : session.distance_km < 1 ? `${Math.round(session.distance_km * 1000)}m` : `${session.distance_km.toFixed(1)}km`;
  const venue = session.venue_name ? (distance ? `${session.venue_name} · ${distance}` : session.venue_name) : null;
  const price = isTicketed ? `${currencySymbol}${session.ticket_price}` : null;
  const note = isPast ? "Ended" : isCreator ? "Hosting" : null;
  const open = onClick ? { onClick: () => onClick() } : { to: `/event/${session.id}` };
  const primary = !isCreator && !isPast
    ? {
        label: participation ? "Going" : isTicketed ? "Get Ticket" : isFull ? "Full" : "Join",
        ariaLabel: participation ? "Going: press to leave" : undefined,
        onClick: handleJoin,
        busy: loading,
        disabled: isFull && !participation,
      }
    : undefined;

  if (compact) {
    return (
      <CardRow
        testId={`session-card-${session.id}`}
        title={session.title}
        open={open}
        lead={
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={session.creator_avatar} />
            <AvatarFallback className="bg-primary/10 text-xs text-primary">{session.creator_name?.charAt(0) || 'S'}</AvatarFallback>
          </Avatar>
        }
        eyebrow={
          <>
            <CardPill tone="type">{kind}</CardPill>
            {price ? <CardPill tone="type">{price}</CardPill> : null}
            {note ? <CardPill>{note}</CardPill> : null}
          </>
        }
        meta={`by ${session.creator_name}`}
        description={session.cover_image_url ? null : session.description}
        tags={[
          <CardPill key="when"><Calendar className="h-3 w-3" aria-hidden />{when}</CardPill>,
          <CardPill key="attendance"><Users className="h-3 w-3" aria-hidden />{attendance}</CardPill>,
          venue ? <CardPill key="venue" className="max-w-full"><MapPin className="h-3 w-3 shrink-0" aria-hidden /><span className="min-w-0 truncate">{venue}</span></CardPill> : null,
        ]}
        controls={
          <button type="button" className={CARD_ICON_BTN} aria-label="Share event" title="Share event" onClick={handleShare}>
            <Share2 className="h-4 w-4" aria-hidden />
          </button>
        }
        primary={primary}
      />
    );
  }

  return (
    <EventCard
      testId={`session-card-${session.id}`}
      title={session.title}
      coverUrl={session.cover_image_url ?? null}
      kindLabel={kind}
      kindIcon={<Calendar className="h-3 w-3" aria-hidden />}
      live={false}
      host={{ name: session.creator_name, avatarUrl: session.creator_avatar ?? null }}
      when={when}
      attendance={attendance}
      note={note ?? session.description ?? null}
      coverExtra={price ? <CardPill tone="type">{price}</CardPill> : null}
      venue={venue}
      open={open}
      primary={primary}
      secondary={{ icon: <Share2 className="h-4 w-4" aria-hidden />, label: "Share event", onClick: handleShare }}
    />
  );
};
