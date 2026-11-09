import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sendEventConfirmationEmail } from "@/utils/eventConfirmationEmail";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, Check, Share2, ExternalLink, Pencil, XCircle, ScanLine,
  MoreVertical, Crown, Ban, CheckCircle, Download,
  X, ChevronDown
} from "lucide-react";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";
import { EventShareKit } from "@/components/sessions/EventShareKit";
import { EditEventDialog } from "@/components/sessions/EditEventDialog";
import { EventCheckInDialog } from "@/components/sessions/EventCheckInDialog";
import { EventCohosts } from "@/components/sessions/EventCohosts";
import { EventRecapButton } from "@/components/sessions/EventRecapButton";
import { EventHeroCard } from "@/components/sessions/EventHeroCard";
import { EventBookingActions } from "@/components/sessions/EventBookingActions";
import { EventHostCard } from "@/components/sessions/EventHostCard";
import { EventCommunityHub } from "@/components/sessions/EventCommunityHub";
import { ShareToMessageDialog } from "@/components/messages/ShareToMessageDialog";
import { GuestRsvpDialog } from "@/components/sessions/GuestRsvpDialog";
import { GuestPassDialog } from "@/components/sessions/GuestPassDialog";
import { EventPhotoWall } from "@/components/sessions/EventPhotoWall";
import { JoinOnlineCard } from "@/components/sessions/JoinOnlineCard";
import { captureRefFromUrl, buildWarmShareMessage, buildEventShareUrl, openDirections } from "@/lib/eventActions";
import { buildEventAuthUrl } from "@/lib/eventAuthRedirect";
import { formatCurrencyAmount } from "@/lib/currency";
import { getEventCountdown } from "@/lib/eventCountdown";
import { getEventBookingLabel, getEventBookingReason, getEventBookingState } from "@/lib/eventBookingState";

const EventPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [eventLoadError, setEventLoadError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [participation, setParticipation] = useState<string | null>(null);
  const [showShareKit, setShowShareKit] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showGuestRsvp, setShowGuestRsvp] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCohosts, setShowCohosts] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [showGuestPass, setShowGuestPass] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const joinInFlight = useRef(false);

  const countdown = useMemo(() => getEventCountdown(event?.start_time, now), [event?.start_time, now]);

  useEffect(() => {
    if (!event?.start_time) return;
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [event?.start_time]);

  useEffect(() => {
    // Wait for auth to resolve before the first fetch -- otherwise this runs
    // once with user still null (auth session not yet restored from
    // storage), renders "Save my spot" for an actually-registered user, and
    // only self-corrects once the auth listener catches up a moment later.
    if (eventId && !authLoading) fetchEvent();
  }, [eventId, user, authLoading]);

  // Handle Stripe redirect: verify ticket purchase and refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketStatus = params.get("ticket");
    const sessionId = params.get("session_id");
    const orderId = params.get("order");
    if (ticketStatus === "success" && (sessionId || orderId)) {
      (async () => {
        try {
          const { data } = await supabase.functions.invoke("verify-event-ticket", {
            body: { sessionId, orderId },
          });
          if (data?.status === "paid") {
            toast({ title: "Ticket confirmed! 🎟️", description: "You're on the guest list." });
            fetchEvent();
          } else {
            toast({ title: "Processing payment…", description: "We'll confirm shortly." });
          }
        } catch {
          // silent
        } finally {
          // Clean URL
          window.history.replaceState({}, "", `/event/${eventId}`);
        }
      })();
    } else if (ticketStatus === "cancelled") {
      toast({ title: "Checkout cancelled", variant: "destructive" });
      window.history.replaceState({}, "", `/event/${eventId}`);
    }
  }, [eventId]);

  const refreshParticipantCount = async (id: string) => {
    setAvailabilityLoading(true);
    try {
      const { count, error } = await supabase
        .from('jam_participants')
        .select('id', { count: 'exact', head: true })
        .eq('jam_id', id)
        .eq('status', 'going');
      if (error) throw error;
      setParticipantCount(count || 0);
      setAvailabilityReady(true);
      setAvailabilityError(null);
      return true;
    } catch (error) {
      setAvailabilityReady(false);
      setAvailabilityError(error instanceof Error ? error.message : "Availability could not be loaded.");
      return false;
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const fetchEvent = async () => {
    if (!eventId) return;
    setLoading(true);
    setEventLoadError(null);
    setAvailabilityReady(false);
    try {
      const { data: eventData, error } = await supabase
        .from('creative_jams').select('*').eq('id', eventId).eq('is_public', true).single();
      if (error || !eventData) {
        setEvent(null);
        setEventLoadError(error?.message || "This event may have been removed or is no longer available.");
        setLoading(false);
        return;
      }
      setEvent(eventData);

      const { data: profileData } = await supabase
        .from('public_profiles_safe')
        .select('user_id, full_name, avatar_url, role, bio, id_verified, verification_status, verification_tier, badge, level, avg_response_hours')
        .eq('user_id', eventData.created_by)
        .single();

      // Also fetch host username (separate, since username is on profiles)
      const { data: hostUsername } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', eventData.created_by)
        .maybeSingle();

      // Count of public events this host has run (trust signal)
      const { count: hostedCount } = await supabase
        .from('creative_jams')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', eventData.created_by)
        .eq('is_public', true);

      setCreator({ ...profileData, username: hostUsername?.username, hostedCount: hostedCount || 0 });

      // Public availability uses a count only; attendee identities stay private.
      await refreshParticipantCount(eventId);

      if (user) {
        const { data: part } = await supabase
          .from('jam_participants').select('status').eq('jam_id', eventId).eq('user_id', user.id).maybeSingle();
        // 'cancelled' is a real stored status (so rsvp_to_event can tell a
        // fresh join from a rejoin), not "no participation" -- treat it the
        // same as no row at all, or a cancelled RSVP would still read as
        // truthy here and show "My pass" / "Cancel RSVP" for someone who
        // already left.
        setParticipation(part && part.status !== 'cancelled' ? part.status : null);
      }
    } catch (err) {
      console.error('Error fetching event:', err);
      setEventLoadError(err instanceof Error ? err.message : "The event couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrSignup = async () => {
    if (!event || !availabilityReady || availabilityLoading || bookingDisabled) return;
    if (event?.external_ticket_url) {
      window.open(event.external_ticket_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (bookingState === "waitlist") {
      await handleJoin();
      return;
    }
    if (isAuthenticated) {
      await handleJoin();
      return;
    }
    if (event?.require_account_for_rsvp && !user) {
      navigate(buildEventAuthUrl(event.id));
      return;
    }
    setShowGuestRsvp(true);
  };

  const handleJoin = async () => {
    if (!user || !event || joinInFlight.current || (!availabilityReady && !participation) || (bookingDisabled && !participation)) return;
    joinInFlight.current = true;
    setJoining(true);
    setBookingError(null);
    try {
      if (participation) {
        const { data: result, error } = await supabase.rpc('cancel_event_rsvp', {
          p_event_id: event.id,
        });
        if (error) throw error;
        if (result === 'not_going') throw new Error("Your RSVP could not be found. Refresh and try again.");
        setParticipation(null);
        await refreshParticipantCount(event.id);
        toast({ title: "RSVP cancelled", description: "Your spot has been released." });
      } else {
        // Capture promoter/host attribution from ?ref= query
        const referredBy = await captureRefFromUrl(event.id);
        const { data: result, error } = await supabase.rpc('rsvp_to_event', {
          p_event_id: event.id,
          p_referred_by: referredBy && referredBy !== user.id ? referredBy : null,
          p_referral_channel: referredBy && referredBy !== user.id ? 'link' : null,
        });
        if (error) throw error;

        if (result === 'waitlisted') {
          setParticipation('waitlisted');
          toast({ title: "You're on the waitlist", description: "We'll notify you the moment a spot opens." });
        } else if (result === 'full_no_waitlist') {
          await refreshParticipantCount(event.id);
          toast({ title: "Event is full", description: "The host hasn't enabled a waitlist for this one.", variant: "destructive" });
        } else if (result === 'already') {
          setParticipation('going');
          await refreshParticipantCount(event.id);
          toast({ title: "Already going", description: "You're already on the guest list." });
        } else if (result === 'joined') {
          setParticipation('going');
          await refreshParticipantCount(event.id);
          toast({ title: "You're in!", description: "You've joined this event" });

          // Look up the new participant row to send confirmation email
          const { data: inserted } = await supabase
            .from('jam_participants')
            .select('id')
            .eq('jam_id', event.id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (inserted) {
            sendEventConfirmationEmail({
              eventId: event.id,
              eventTitle: event.title,
              startTime: event.start_time,
              endTime: event.end_time,
              venueName: event.venue_name,
              venueAddress: event.venue_address,
              isTicketed: false,
              participantId: inserted.id,
            }).catch(() => {});
          }
        } else {
          throw new Error("The event did not confirm your RSVP.");
        }
      }
    } catch (err) {
      console.error('RSVP error:', err);
      const message = err instanceof Error ? err.message : "Failed to update RSVP.";
      setBookingError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      joinInFlight.current = false;
      setJoining(false);
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <KretopiaLoader />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">{eventLoadError ? "Event unavailable" : "Event not found"}</h2>
            <p className="text-muted-foreground mb-6">{eventLoadError || "This event may have been removed or is no longer available."}</p>
            <div className="flex justify-center gap-2">
              {eventLoadError && <Button variant="outline" onClick={fetchEvent}>Try again</Button>}
              <Button onClick={() => navigate('/')}>Go Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const startTime = Date.parse(event.start_time);
  const endTime = Date.parse(event.end_time || event.start_time);
  const eventTimeValid = Number.isFinite(startTime) && Number.isFinite(endTime);
  const isPast = eventTimeValid && endTime <= now;
  const capacity = Number(event.max_participants) > 0 ? Number(event.max_participants) : 0;
  const isFull = availabilityReady && capacity > 0 && participantCount >= capacity;
  const isCreator = user?.id === event.created_by;
  const isAuthenticated = !!user;
  const isTicketed = event.is_ticketed && event.ticket_price > 0;
  const ticketCurrency = typeof event.ticket_currency === "string" ? event.ticket_currency.trim().toUpperCase() : "";
  const ticketPriceLabel = isTicketed
    ? formatCurrencyAmount(event.ticket_price, ticketCurrency) ?? "Paid ticket · currency unavailable"
    : null;
  const isCancelled = event.status === 'cancelled';
  const isCompleted = event.status === 'completed';
  const hasExternalTicket = !!event.external_ticket_url;
  const waitlistEnabled = event.waitlist_enabled === true;
  const bookingState = getEventBookingState({
    loading: availabilityLoading,
    availabilityReady: availabilityReady && eventTimeValid,
    cancelled: isCancelled,
    ended: isPast || isCompleted,
    hosting: isCreator,
    participation,
    full: isFull,
    waitlistEnabled,
    authenticated: isAuthenticated,
    nativePaid: isTicketed && !hasExternalTicket,
  });
  const bookingDisabled = !["available", "waitlist"].includes(bookingState);
  const bookingLabel = getEventBookingLabel(bookingState);
  const bookingReason = bookingError || getEventBookingReason(bookingState);
  const cityLabel = event.event_mode && event.event_mode !== "irl"
    ? "Online"
    : event.venue_name || null;

  const spotsLeft = availabilityReady && capacity > 0 ? capacity - participantCount : null;
  const showScarcity = capacity > 0 && spotsLeft !== null && spotsLeft > 0 && spotsLeft / capacity < 0.3;

  return (
    <>
      <SEO 
        title={`${event.title} | Kretopia Event`}
        description={event.description?.slice(0, 155) || `Join ${creator?.full_name || 'a creator'} for ${event.title} on Kretopia`}
        type="article"
        image={event.cover_image_url || undefined}
        url={`https://kretopia.com/event/${eventId}`}
      />
      {/* JSON-LD Event Schema */}
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            "name": event.title,
            "description": event.description || '',
            "startDate": event.start_time,
            "endDate": event.end_time || undefined,
            "eventAttendanceMode": event.event_type === 'virtual' 
              ? "https://schema.org/OnlineEventAttendanceMode" 
              : "https://schema.org/OfflineEventAttendanceMode",
            "location": event.venue_name ? {
              "@type": "Place",
              "name": event.venue_name,
              "address": event.venue_address || ''
            } : undefined,
            "image": event.cover_image_url || undefined,
            "organizer": {
              "@type": "Person",
              "name": creator?.full_name || 'Kretopia Host'
            },
            "offers": isTicketed && formatCurrencyAmount(event.ticket_price, ticketCurrency) ? {
              "@type": "Offer",
              "price": event.ticket_price,
              "priceCurrency": ticketCurrency,
              "availability": isFull ? "https://schema.org/SoldOut" : "https://schema.org/InStock"
            } : undefined
          })}
        </script>
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:pb-16">

          {/* RSVP success banner (after guest quick-RSVP) */}
          {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("rsvp") === "confirmed" && (
            <div className="mb-4 p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {new URLSearchParams(window.location.search).get("source") === "email" ? (
                  <>
                    <p className="font-semibold text-foreground">Attendance confirmed 🎉</p>
                    <p className="text-sm text-muted-foreground">
                      Great to have you
                      {new URLSearchParams(window.location.search).get("name")
                        ? `, ${new URLSearchParams(window.location.search).get("name")}`
                        : ""}
                      . Your spot is locked in. Here's the full event below.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-foreground">You're going! 🎉</p>
                    <p className="text-sm text-muted-foreground">
                      Confirmation sent to{" "}
                      <span className="text-foreground font-medium">
                        {new URLSearchParams(window.location.search).get("email") || "your email"}
                      </span>
                      . Here's the full event below.
                    </p>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -mr-1 -mt-1 shrink-0"
                onClick={() => navigate(`/event/${event.id}`, { replace: true })}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          
          {/* Cancelled/Completed Banner */}
          {isCancelled && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-semibold text-destructive">Event Cancelled</p>
                {event.status_note && <p className="text-sm text-muted-foreground">{event.status_note}</p>}
              </div>
            </div>
          )}
          {isCompleted && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600 shrink-0" />
              <p className="font-semibold text-green-600">Event Completed</p>
            </div>
          )}

          {/* Host Actions */}
          {isCreator && (
            <div className="flex justify-end gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={() => setShowCheckIn(true)} className="gap-1.5">
                <ScanLine className="h-3.5 w-3.5" /> Check-In
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="px-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => navigate("/events/backstage")}>
                    <Sparkles className="h-4 w-4 mr-2" /> Open Backstage
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowShareKit(true)}>
                    <Share2 className="h-4 w-4 mr-2" /> Share / QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCohosts(true)}>
                    <Crown className="h-4 w-4 mr-2" /> Manage Co-hosts
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowRecap(true)}>
                    <Sparkles className="h-4 w-4 mr-2" /> Post Update / Recap
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    const { data: parts } = await supabase
                      .from('jam_participants')
                      .select('user_id, guest_name, guest_email, status, joined_at')
                      .eq('jam_id', event.id)
                      .in('status', ['going', 'interested', 'maybe']);
                    const userIds = (parts || []).map((p: any) => p.user_id).filter(Boolean);
                    const { data: profiles } = userIds.length > 0
                      ? await supabase.from('public_profiles_safe').select('user_id, full_name, role').in('user_id', userIds)
                      : { data: [] };
                    const pMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
                    const rows = [["Name", "Role", "Email", "Status", "Joined At"]];
                    if (creator) rows.push([creator.full_name || "Host", creator.role || "", "", "Host", ""]);
                    (parts || []).forEach((p: any) => {
                      const prof = pMap.get(p.user_id) as any;
                      rows.push([prof?.full_name || p.guest_name || "Guest", prof?.role || (p.user_id ? "" : "Guest RSVP"), p.guest_email || "", p.status, p.joined_at ? new Date(p.joined_at).toLocaleDateString() : ""]);
                    });
                    const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `guest-list-${event.id.slice(0, 8)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "Guest list downloaded" });
                  }}>
                    <Download className="h-4 w-4 mr-2" /> Download Guest List
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {!isPast && !isCompleted && (
                    <DropdownMenuItem onClick={async () => {
                      await supabase.from('creative_jams').update({ status: 'completed' } as any).eq('id', event.id).eq('created_by', user?.id || '');
                      toast({ title: "Event marked complete" });
                      fetchEvent();
                    }}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Mark Complete
                    </DropdownMenuItem>
                  )}
                  {!isCancelled && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        await supabase.from('creative_jams').update({ status: 'cancelled' } as any).eq('id', event.id).eq('created_by', user?.id || '');
                        toast({ title: "Event cancelled" });
                        fetchEvent();
                      }}
                    >
                      <Ban className="h-4 w-4 mr-2" /> Cancel Event
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          
          {/* Event hero: cover, title, host, countdown, gallery, when/where/capacity */}
          <EventHeroCard
            event={event}
            creator={creator}
            isCreator={isCreator}
            isAuthenticated={isAuthenticated}
            isPast={isPast}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
            countdown={countdown}
            cityLabel={cityLabel}
            priceLabel={ticketPriceLabel}
            bookingLabel={bookingLabel}
            bookingReason={bookingReason}
            bookingDisabled={bookingDisabled}
            participantCount={availabilityReady ? participantCount : null}
            capacity={capacity}
            isFull={isFull}
            spotsLeft={spotsLeft}
            showScarcity={showScarcity}
            participation={participation}
            joining={joining}
            onBook={handleJoinOrSignup}
            onShare={handleShare}
            onShowGuestPass={() => setShowGuestPass(true)}
            onCancelRsvp={handleJoin}
            onGalleryChange={(urls) => setEvent((prev: any) => prev ? { ...prev, gallery_image_urls: urls } : prev)}
          />

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <main className="min-w-0 space-y-6">
              {event.event_mode && event.event_mode !== 'irl' && !isPast && !isCancelled && (
                <JoinOnlineCard
                  eventId={event.id}
                  eventTitle={event.title}
                  startTime={event.start_time}
                  eventMode={event.event_mode}
                  onlineFormat={event.online_format}
                  onlineMaxAttendees={event.online_max_attendees}
                  watchPartyVideoUrl={event.watch_party_video_url}
                  recordingEnabled={!!event.recording_enabled}
                  videoRoomStartedAt={event.video_room_started_at}
                  hasAccess={isCreator || !!participation || (isTicketed && !!participation)}
                  needsRsvp={!participation && !isTicketed}
                  isHost={isCreator}
                />
              )}

              <Card id="about">
                <CardContent className="p-5 sm:p-7">
                  <h2 className="text-xl font-semibold">About</h2>
                  {event.description ? (
                    <>
                      <p className={`mt-3 whitespace-pre-wrap text-muted-foreground ${!descExpanded && event.description.length > 640 ? "line-clamp-8" : ""}`}>
                        {event.description}
                      </p>
                      {event.description.length > 640 && (
                        <button
                          type="button"
                          onClick={() => setDescExpanded((value) => !value)}
                          className="mt-3 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {descExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </>
                  ) : <p className="mt-3 text-muted-foreground">The host hasn't added an event description yet.</p>}
                </CardContent>
              </Card>

              <Card id="program">
                <CardContent className="p-5 sm:p-7">
                  <h2 className="text-xl font-semibold">Line-up &amp; program</h2>
                  <p className="mt-3 text-muted-foreground">No line-up or program details are listed for this event.</p>
                </CardContent>
              </Card>

              <Card id="venue">
                <CardContent className="p-5 sm:p-7">
                  <h2 className="text-xl font-semibold">Venue</h2>
                  {event.event_mode && event.event_mode !== "irl" ? (
                    <p className="mt-3 text-muted-foreground">Online event{event.online_format ? ` · ${event.online_format}` : ""}.</p>
                  ) : (
                    <>
                      <p className="mt-3 font-medium">{event.venue_name || "Location to be announced"}</p>
                      {isAuthenticated && event.venue_address && <p className="mt-1 text-sm text-muted-foreground">{event.venue_address}</p>}
                      {!isAuthenticated && event.venue_address && <p className="mt-1 text-sm text-muted-foreground">Sign in to see the full address.</p>}
                      {isAuthenticated && (event.venue_address || event.venue_name) && (
                        <Button variant="outline" className="mt-4" onClick={() => openDirections(event.venue_address, event.venue_name)}>
                          <ExternalLink className="mr-2 h-4 w-4" aria-hidden /> Open map
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <section id="host" aria-labelledby="event-host-heading">
                <h2 id="event-host-heading" className="sr-only">Host</h2>
                <EventHostCard
                  host={creator}
                  isAuthenticated={isAuthenticated}
                  onOpenPassport={(username) => navigate(`/u/${username}`)}
                  onSignIn={() => navigate(buildEventAuthUrl(event.id))}
                />
              </section>

              <Card id="policies">
                <CardContent className="p-5 sm:p-7">
                  <h2 className="text-xl font-semibold">Policies</h2>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>{event.require_account_for_rsvp ? "An account is required to RSVP." : "Guests may RSVP without creating an account."}</li>
                    <li>RSVP availability is confirmed by the event service; the displayed count is refreshed from the server.</li>
                    <li>{isTicketed && !hasExternalTicket ? "Online payment booking is unavailable for this event." : "You can cancel an RSVP from this page while cancellation remains available."}</li>
                  </ul>
                  {event.status_note && <p className="mt-4 text-sm text-muted-foreground">{event.status_note}</p>}
                </CardContent>
              </Card>

              <Card id="faq">
                <CardContent className="p-5 sm:p-7">
                  <h2 className="text-xl font-semibold">FAQ</h2>
                  <div className="mt-4 space-y-4">
                    <div>
                      <h3 className="font-medium">How do I book?</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Use Book to RSVP. Your place is shown only after the server confirms it.</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Can I cancel?</h3>
                      <p className="mt-1 text-sm text-muted-foreground">If you're going, use Cancel RSVP on this page. The cancellation is confirmed by the event service.</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Where do I find the address?</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{event.venue_address && !isAuthenticated ? "Sign in to view the full address." : "Venue details are shown in the Venue section."}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {availabilityReady && (
                <EventCommunityHub
                  eventId={event.id}
                  eventTitle={event.title}
                  eventCategory={event.category}
                  eventCoverImageUrl={event.cover_image_url}
                  hostId={event.created_by}
                  isCreator={isCreator}
                  isAuthenticated={isAuthenticated}
                  currentUserId={user?.id || null}
                  isParticipant={!!participation}
                  participantCount={participantCount}
                  attendeeListVisibility={event.attendee_list_visibility}
                  guestMatchingEnabled={event.guest_matching_enabled !== false}
                  isPast={isPast}
                  isCompleted={isCompleted}
                  groupChatEnabled={!!event.group_chat_enabled}
                  groupChatRoomId={event.group_chat_room_id || null}
                  onGroupChatChange={({ enabled, roomId }) => setEvent((prev: any) => prev ? { ...prev, group_chat_enabled: enabled, group_chat_room_id: roomId } : prev)}
                  circleId={event.circle_id || null}
                  onCircleLinked={fetchEvent}
                />
              )}

              {(isPast || isCompleted) && event.photo_wall_enabled !== false && (
                <EventPhotoWall eventId={event.id} isHost={isCreator} canUpload={isCreator || !!participation} />
              )}
            </main>

            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 shadow-[0_20px_70px_-45px_hsl(var(--primary)/0.28)]">
                <EventBookingActions
                  label={bookingLabel}
                  priceLabel={ticketPriceLabel}
                  goingLabel={availabilityReady ? `${participantCount} going${capacity ? ` · ${capacity} places` : ""}` : "Attendance count unavailable"}
                  reason={bookingReason}
                  disabled={bookingDisabled}
                  joining={joining}
                  onBook={handleJoinOrSignup}
                />
                {hasExternalTicket && <p className="mt-3 text-xs text-muted-foreground">Tickets and payment are handled by the external provider.</p>}
                {isCreator && <Button variant="outline" className="mt-4 w-full" onClick={() => setShowShareKit(true)}>Share with your network</Button>}
              </div>
            </aside>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
            <EventBookingActions
              compact
              label={bookingLabel}
              priceLabel={ticketPriceLabel}
              goingLabel={availabilityReady ? `${participantCount} going` : "Count unavailable"}
              reason={bookingReason}
              disabled={bookingDisabled}
              joining={joining}
              onBook={handleJoinOrSignup}
            />
          </div>

          {isAuthenticated && (
            <EventShareKit
              event={event}
              hostFirstName={creator?.full_name?.split(" ")[0]}
              attendeeCount={participantCount}
              open={showShareKit}
              onOpenChange={setShowShareKit}
            />
          )}

          <ShareToMessageDialog
            open={showShareDialog}
            onOpenChange={setShowShareDialog}
            contentType="event"
            contentId={event.id}
            contentMeta={{
              title: event.title,
              subtitle: event.venue_name || undefined,
              image_url: event.cover_image_url,
            }}
            externalUrl={buildEventShareUrl(event.id)}
            externalText={
              buildWarmShareMessage(
                {
                  id: event.id,
                  title: event.title,
                  startTime: event.start_time,
                  venueName: event.venue_name,
                  isTicketed: event.is_ticketed,
                  ticketPrice: event.ticket_price,
                  ticketCurrency: event.ticket_currency,
                  attendeeCount: participantCount,
                },
                {
                  hostFirstName: creator?.full_name?.split(" ")[0],
                  isHost: isCreator,
                }
              ).text
            }
          />

          <GuestRsvpDialog
            open={showGuestRsvp}
            onOpenChange={setShowGuestRsvp}
            eventId={event.id}
            eventTitle={event.title}
            startTime={event.start_time}
            endTime={event.end_time}
            venueName={event.venue_name}
            venueAddress={event.venue_address}
            onRsvpComplete={() => {
              setParticipation('going');
              refreshParticipantCount(event.id);
            }}
          />

          {user && participation && (
            <GuestPassDialog
              open={showGuestPass}
              onOpenChange={setShowGuestPass}
              eventId={event.id}
              eventTitle={event.title}
              startTime={event.start_time}
              venueName={event.venue_name}
              userId={user.id}
              guestName={user.user_metadata?.full_name || user.email}
            />
          )}
          
          {isCreator && (
            <EditEventDialog 
              eventId={event.id} 
              open={showEditDialog} 
              onOpenChange={setShowEditDialog} 
              onUpdated={fetchEvent}
            />
          )}
          {isCreator && (
            <EventCheckInDialog
              eventId={event.id}
              eventTitle={event.title}
              open={showCheckIn}
              onOpenChange={setShowCheckIn}
            />
          )}
          {isCreator && showCohosts && (
            <Dialog open={showCohosts} onOpenChange={setShowCohosts}>
              <DialogContent className="max-w-md">
                <EventCohosts eventId={event.id} isCreator={isCreator} />
              </DialogContent>
            </Dialog>
          )}
          {isCreator && showRecap && (
            <Dialog open={showRecap} onOpenChange={setShowRecap}>
              <DialogContent className="max-w-sm">
                <div className="space-y-4 py-2">
                  <h3 className="font-semibold text-lg">Post Event Update / Recap</h3>
                  <p className="text-sm text-muted-foreground">Share an update or recap of this event to your feed so your network can see what's happening.</p>
                  <EventRecapButton
                    eventId={event.id}
                    eventTitle={event.title}
                    eventCategory={event.category}
                    venueName={event.venue_name}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </>
  );
};

export default EventPage;
