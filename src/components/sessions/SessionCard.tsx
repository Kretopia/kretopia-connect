import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Calendar, Clock, Users, Check, Loader2, Ticket, Share2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { sendEventConfirmationEmail } from "@/utils/eventConfirmationEmail";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { APP_URL } from "@/lib/constants";

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
  event_type?: string;
  cover_image_url?: string;
}

interface SessionCardProps {
  session: Session;
  userParticipation?: 'going' | 'interested' | 'maybe' | null;
  onJoin?: () => void;
  onClick?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music', film: 'Film', photo: 'Photo', art: 'Art',
  podcast: '🎙Podcast', workshop: 'Workshop', networking: 'Networking',
  content: 'Content', festival: 'Festival', showcase: 'Showcase',
  general: 'Creative',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', IDR: 'Rp', TTD: 'TT$',
};

export const SessionCard = ({ session, userParticipation, onJoin, onClick }: SessionCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [participation, setParticipation] = useState(userParticipation);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in to join events", variant: "destructive" });
      return;
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
          {isTicketed && (
            <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs">
              {currencySymbol}{session.ticket_price}
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
              <span className="font-semibold text-primary">{currencySymbol}{session.ticket_price?.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{session.participant_count} / {session.max_participants} going</span>
            {isFull && <Badge variant="destructive" className="text-[10px] ml-auto py-0 px-1.5">Full</Badge>}
          </div>
        </div>

        <div className="flex gap-2">
          {!isCreator && !isPast && (
            <Button onClick={handleJoin} disabled={loading || (isFull && !participation)}
              variant={participation ? "outline" : "gradient"} size="sm" className="flex-1 text-xs h-8">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : participation ? (
                <><Check className="h-3.5 w-3.5 mr-1" /> Going</>
              ) : isTicketed ? (
                <><Ticket className="h-3.5 w-3.5 mr-1" /> Get Ticket</>
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
