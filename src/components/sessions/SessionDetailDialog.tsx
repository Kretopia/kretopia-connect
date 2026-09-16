import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MapPin, Calendar, Clock, Users, Check, Loader2, 
  MessageCircle, Share2, Ticket, X, ExternalLink, Pencil, MoreVertical, Crown, Sparkles, Ban, CheckCircle
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { sendEventConfirmationEmail } from "@/utils/eventConfirmationEmail";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SessionParticipants } from "./SessionParticipants";
import { SessionChat } from "./SessionChat";
import { EventShareKit } from "./EventShareKit";
import { EditEventDialog } from "./EditEventDialog";

import { EventCohosts } from "./EventCohosts";
import { EventRecapButton } from "./EventRecapButton";
import { EventCheckInDialog } from "./EventCheckInDialog";
// ContinueAsCircle removed — event→circle linking deprecated

interface Session {
  id: string;
  title: string;
  description?: string;
  category: string;
  venue_name?: string;
  venue_address?: string;
  start_time: string;
  end_time?: string;
  max_participants: number;
  participant_count: number;
  distance_km?: number;
  creator_name: string;
  creator_avatar?: string;
  created_by: string;
  cover_image_url?: string;
  is_ticketed?: boolean;
  ticket_price?: number;
  ticket_currency?: string;
  event_type?: string;
  external_ticket_url?: string;
  status?: string;
  status_note?: string;
  circle_id?: string | null;
}

interface SessionDetailDialogProps {
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
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

export const SessionDetailDialog = ({ 
  session, open, onOpenChange, onRefresh 
}: SessionDetailDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [participation, setParticipation] = useState<'going' | 'interested' | 'maybe' | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showShareKit, setShowShareKit] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCohosts, setShowCohosts] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);

  useEffect(() => {
    if (open && session && user) {
      checkParticipation();
    }
  }, [open, session, user]);

  const checkParticipation = async () => {
    if (!session || !user) return;
    const { data } = await supabase
      .from('jam_participants')
      .select('status')
      .eq('jam_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle();
    // 'cancelled' is a real stored status, not "no participation" -- see
    // the identical fix in EventPage.tsx's fetchEvent.
    setParticipation((data && data.status !== 'cancelled' ? data.status : null) as any);
  };

  const handleJoin = async () => {
    if (!user || !session) {
      toast({ title: "Not authenticated", description: "Please log in to join events", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (participation) {
        await supabase.from('jam_participants').delete().eq('jam_id', session.id).eq('user_id', user.id);
        setParticipation(null);
        toast({ title: "Left event" });
        onRefresh?.();
      } else if (session.is_ticketed && session.ticket_price && session.ticket_price > 0 && !session.external_ticket_url) {
        // Ticketed event — redirect to Stripe checkout
        const { data, error } = await supabase.functions.invoke('purchase-event-ticket', {
          body: { eventId: session.id }
        });
        if (error) throw error;
        if (data?.url) {
          const opened = window.open(data.url, '_blank');
          if (!opened) window.location.href = data.url;
        } else {
          throw new Error("No checkout URL received");
        }
      } else {
        // Free event — join directly
        const { data: inserted } = await supabase.from('jam_participants').insert({ jam_id: session.id, user_id: user.id, status: 'going' }).select('id').single();
        setParticipation('going');
        toast({ title: "You're in!" });
        onRefresh?.();
        if (inserted) {
          sendEventConfirmationEmail({
            eventId: session.id,
            eventTitle: session.title,
            startTime: session.start_time,
            endTime: session.end_time,
            venueName: session.venue_name,
            venueAddress: session.venue_address,
            isTicketed: false,
            participantId: inserted.id,
          });
        }
      }
    } catch (err: any) {
      console.error('Join/ticket error:', err);
      toast({ title: "Error", description: err?.message || "Failed to process. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const isCreator = user?.id === session.created_by;
  const isFull = session.participant_count >= session.max_participants;
  const startDate = new Date(session.start_time);
  const isPast = startDate < new Date();
  const isParticipant = !!participation || isCreator;
  const isTicketed = session.is_ticketed && session.ticket_price && session.ticket_price > 0;
  const currencySymbol = CURRENCY_SYMBOLS[session.ticket_currency || 'USD'] || session.ticket_currency || '$';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] h-[100dvh] sm:h-[85vh] flex flex-col p-0 overflow-hidden gap-0 rounded-none sm:rounded-lg [&>button:last-child]:hidden">
          {/* Hero Cover Image */}
          <div className="relative shrink-0">
            {session.cover_image_url ? (
              <div className="relative h-28 sm:h-44">
                <img src={session.cover_image_url} alt={session.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              </div>
            ) : (
              <div className="h-14 sm:h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20" />
            )}
            
            {/* Top-right actions */}
            <div className="absolute top-2 right-2 flex gap-1.5">
              {isCreator && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80 rounded-full">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit Event
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowShareKit(true)}>
                      <Share2 className="h-4 w-4 mr-2" /> Share / QR Code
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowCohosts(true)}>
                      <Crown className="h-4 w-4 mr-2" /> Manage Co-hosts
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowCheckIn(true)}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Check In Guests
                    </DropdownMenuItem>
                    {isPast && (
                      <DropdownMenuItem onClick={() => setShowRecap(true)}>
                        <Sparkles className="h-4 w-4 mr-2" /> Post Recap
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        await supabase.from('creative_jams').update({ status: 'cancelled', status_note: 'Cancelled by host' } as any).eq('id', session.id).eq('created_by', user?.id || '');
                        toast({ title: "Event cancelled" });
                        onRefresh?.();
                        onOpenChange(false);
                      }}
                    >
                      <Ban className="h-4 w-4 mr-2" /> Cancel Event
                    </DropdownMenuItem>
                    {!isPast && (
                      <DropdownMenuItem onClick={async () => {
                        await supabase.from('creative_jams').update({ status: 'completed' } as any).eq('id', session.id).eq('created_by', user?.id || '');
                        toast({ title: "Event marked complete" });
                        onRefresh?.();
                        onOpenChange(false);
                      }}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Mark Complete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80 rounded-full"
                onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Category badge */}
            <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
              {CATEGORY_LABELS[session.category] || session.category}
            </Badge>
          </div>

          {/* Event Info Header */}
          <div className="px-4 sm:px-5 pb-3 pt-2 border-b shrink-0 space-y-2">
            <div className="flex items-start gap-2.5">
              <Avatar className="h-9 w-9 ring-2 ring-primary/30 shrink-0">
                <AvatarImage src={session.creator_avatar} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {session.creator_name?.charAt(0) || 'S'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold leading-tight">{session.title}</h2>
                <p className="text-xs text-muted-foreground">Hosted by {session.creator_name}</p>
              </div>
            </div>

            {/* Quick Info Row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {format(startDate, "EEE, MMM d")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {format(startDate, "h:mm a")}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {session.participant_count}/{session.max_participants}
              </span>
              {isTicketed && (
                <span className="flex items-center gap-1.5 text-primary font-semibold">
                  <Ticket className="h-3.5 w-3.5" /> {currencySymbol}{session.ticket_price?.toFixed(2)}
                </span>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-2">
              {!isPast && !isCreator && session.status !== 'cancelled' && (
                <Button
                  onClick={() => {
                    if (session.external_ticket_url && !participation) {
                      window.open(session.external_ticket_url, '_blank');
                      return;
                    }
                    handleJoin();
                  }}
                  disabled={loading || (isFull && !participation)}
                  variant={participation ? "outline" : "gradient"}
                  size="sm"
                  className="flex-1"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : participation ? (
                    <><Check className="h-4 w-4 mr-1.5" /> Going</>
                  ) : isTicketed ? (
                    <>{session.external_ticket_url ? <ExternalLink className="h-4 w-4 mr-1.5" /> : <Ticket className="h-4 w-4 mr-1.5" />} Get Ticket — {currencySymbol}{session.ticket_price}</>
                  ) : isFull ? "Full" : "Join Event"}
                </Button>
              )}
              {session.status === 'cancelled' && (
                <Badge variant="destructive" className="flex-1 justify-center py-2">Event Cancelled</Badge>
              )}
              {isCreator && !isPast && session.status !== 'cancelled' && (
                <Badge variant="secondary" className="flex-1 justify-center py-2">You're hosting</Badge>
              )}
              {isPast && session.status !== 'cancelled' && (
                <Badge variant="outline" className="flex-1 justify-center py-2">Event ended</Badge>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowShareKit(true)} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="mx-3 sm:mx-5 mt-2 overflow-x-auto scrollbar-hide shrink-0">
            <TabsList className="w-max">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="participants">
                <Users className="h-4 w-4 mr-1" /> People ({session.participant_count})
              </TabsTrigger>
              <TabsTrigger value="chat">
                <MessageCircle className="h-4 w-4 mr-1" /> Chat
              </TabsTrigger>
            </TabsList>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <TabsContent value="details" className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 m-0 data-[state=inactive]:hidden">
                <div className="space-y-5">
                  {session.description && (
                    <div>
                      <h4 className="font-semibold mb-2">About</h4>
                      <p className="text-muted-foreground whitespace-pre-wrap">{session.description}</p>
                    </div>
                  )}

                  {session.venue_name && (
                    <div>
                      <h4 className="font-semibold mb-2">Location</h4>
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                        <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{session.venue_name}</p>
                          {session.venue_address && <p className="text-sm text-muted-foreground">{session.venue_address}</p>}
                          {session.distance_km !== undefined && (
                            <p className="text-sm text-primary mt-1">
                              {session.distance_km < 1 ? `${Math.round(session.distance_km * 1000)}m away` : `${session.distance_km.toFixed(1)}km away`}
                            </p>
                          )}
                        </div>
                        {session.venue_address && (
                          <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" asChild>
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(session.venue_address)}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Ticket Info */}
                  {isTicketed && (
                    <div>
                      <h4 className="font-semibold mb-2">Tickets</h4>
                      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">{currencySymbol}{session.ticket_price?.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">General Admission</p>
                          </div>
                          {!isCreator && !isPast && !participation && (
                            <Button variant="gradient" size="sm" onClick={() => {
                              if (session.external_ticket_url) {
                                window.open(session.external_ticket_url, '_blank');
                              } else {
                                handleJoin();
                              }
                            }} disabled={loading || isFull}>
                              <Ticket className="h-4 w-4 mr-1.5" /> Get Ticket
                            </Button>
                          )}
                          {participation && (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                              <Check className="h-3 w-3 mr-1" /> Ticket Secured
                            </Badge>
                          )}
                        </div>
                        {session.external_ticket_url && (
                          <p className="text-xs text-muted-foreground mt-2">Tickets via external platform</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="participants" className="flex-1 overflow-y-auto m-0 data-[state=inactive]:hidden">
                <SessionParticipants sessionId={session.id} creatorId={session.created_by} isCreator={isCreator} onRefresh={onRefresh} />
              </TabsContent>

              <TabsContent value="chat" className="flex-1 m-0 flex flex-col min-h-0 data-[state=inactive]:hidden">
                <SessionChat sessionId={session.id} isCreator={isCreator} />
              </TabsContent>

            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {session && (
        <EventShareKit event={session} open={showShareKit} onOpenChange={setShowShareKit} />
      )}
      {session && isCreator && (
        <EditEventDialog 
          eventId={session.id} 
          open={showEditDialog} 
          onOpenChange={setShowEditDialog} 
          onUpdated={() => { onRefresh?.(); onOpenChange(false); }}
        />
      )}
      {session && isCreator && showCohosts && (
        <Dialog open={showCohosts} onOpenChange={setShowCohosts}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <EventCohosts eventId={session.id} isCreator={isCreator} />
          </DialogContent>
        </Dialog>
      )}
      {session && isCreator && showRecap && (
        <Dialog open={showRecap} onOpenChange={setShowRecap}>
          <DialogContent className="max-w-sm">
            <div className="space-y-4 py-2">
              <h3 className="font-semibold text-lg">Post Event Recap</h3>
              <p className="text-sm text-muted-foreground">Share a recap of this event to your feed so your network can see what happened.</p>
              <EventRecapButton 
                eventId={session.id} 
                eventTitle={session.title} 
                eventCategory={session.category}
                venueName={session.venue_name}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
      {session && isCreator && (
        <EventCheckInDialog
          eventId={session.id}
          eventTitle={session.title}
          open={showCheckIn}
          onOpenChange={setShowCheckIn}
        />
      )}
    </>
  );
};
