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
  Sparkles, Check, Share2, ExternalLink, XCircle,
  CheckCircle,
  X, ChevronDown
} from "lucide-react";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";
import { EventShareKit } from "@/components/sessions/EventShareKit";
import { EditEventDialog } from "@/components/sessions/EditEventDialog";
import { EventCheckInDialog } from "@/components/sessions/EventCheckInDialog";
import { EventCohosts } from "@/components/sessions/EventCohosts";
import { EventRecapButton } from "@/components/sessions/EventRecapButton";
import { EventHeroCard } from "@/components/sessions/EventHeroCard";
import { EventAboutSection } from "@/components/sessions/EventAboutSection";
import { EventCalendarWorkspace } from "@/components/sessions/EventCalendarWorkspace";
import { EventRsvpSuccessDialog } from "@/components/sessions/EventRsvpSuccessDialog";
import type { EventAttendeePreview } from "@/components/sessions/EventAttendeeStack";
import { EventBookingActions } from "@/components/sessions/EventBookingActions";
import { EventHostCard } from "@/components/sessions/EventHostCard";
import { EventHostBar } from "@/components/sessions/EventHostBar";
import { EventCalendarActions, type CalendarActionEvent } from "@/components/sessions/EventCalendarActions";
import { EventSectionsDialog } from "@/components/sessions/EventSectionsDialog";
import { SectionFaq, SectionLines } from "@/components/sessions/EventSectionContent";
import { EventCommunityHub } from "@/components/sessions/EventCommunityHub";
import { EventPageShell, EVENT_PAGE_CONTENT_CLASS } from "@/components/sessions/EventPageShell";
import { ShareToMessageDialog } from "@/components/messages/ShareToMessageDialog";
import { GuestRsvpDialog } from "@/components/sessions/GuestRsvpDialog";
import { cancelEventRsvp } from "@/lib/eventRsvp";
import { GuestPassDialog } from "@/components/sessions/GuestPassDialog";
import { EventPhotoWall } from "@/components/sessions/EventPhotoWall";
import { JoinOnlineCard } from "@/components/sessions/JoinOnlineCard";
import { captureRefFromUrl, buildWarmShareMessage, buildEventShareUrl } from "@/lib/eventActions";
import { buildEventAuthUrl } from "@/lib/eventAuthRedirect";
import { formatCurrencyAmount } from "@/lib/currency";
import { getEventCountdown } from "@/lib/eventCountdown";
import { getEventBookingLabel, getEventBookingReason, getEventBookingState } from "@/lib/eventBookingState";
import { addToKretopiaCalendar, fetchCalendarEntries, removeFromKretopiaCalendar } from "@/lib/eventCalendar";
import { emptySections, fetchEventSections, viewSection, type EventSectionKey, type FetchedSections } from "@/lib/eventSections";
import { APP_URL } from "@/lib/constants";

const EventPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [attendeePreview, setAttendeePreview] = useState<EventAttendeePreview[]>([]);
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSections, setShowSections] = useState(false);
  // The viewer's own Kretopia calendar is a list of its own: saving an event to it is not an RSVP and changes no count.
  const [calendarIds, setCalendarIds] = useState<Set<string>>(() => new Set());
  const [calendarAvailable, setCalendarAvailable] = useState(false);
  const [calendarBusyId, setCalendarBusyId] = useState<string | null>(null);
  const [sectionsLoaded, setSectionsLoaded] = useState<FetchedSections>({ sections: emptySections(), available: false, loadFailed: false });
  const [successSequence, setSuccessSequence] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const joinInFlight = useRef(false);
  const verifiedTicketRef = useRef<string | null>(null);
  const calendarReturnFocus = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    let active = true;
    fetchCalendarEntries(user?.id ?? null).then((entries) => {
      if (!active) return;
      setCalendarIds(entries.ids);
      setCalendarAvailable(entries.available);
    });
    return () => { active = false; };
  }, [user?.id]);

  // Handle Stripe redirect: verify ticket purchase and refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketStatus = params.get("ticket");
    const sessionId = params.get("session_id");
    const orderId = params.get("order");
    const verificationId = sessionId || orderId;
    if (ticketStatus === "success" && verificationId && verifiedTicketRef.current !== verificationId) {
      verifiedTicketRef.current = verificationId;
      (async () => {
        try {
          const { data } = await supabase.functions.invoke("verify-event-ticket", {
            body: { sessionId, orderId },
          });
          if (data?.status === "paid") {
            setSuccessSequence((sequence) => sequence + 1);
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

  const refreshAttendeePreview = async (id: string, canView: boolean) => {
    if (!canView) {
      setAttendeePreview([]);
      return;
    }
    try {
      const { data: rows, error } = await supabase
        .from("jam_participants")
        .select("user_id")
        .eq("jam_id", id)
        .eq("status", "going")
        .not("user_id", "is", null)
        .limit(3);
      if (error) throw error;
      const userIds = [...new Set((rows || []).map((row) => row.user_id).filter((value): value is string => !!value))];
      if (!userIds.length) {
        setAttendeePreview([]);
        return;
      }
      const { data: profiles, error: profileError } = await supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      if (profileError) throw profileError;
      setAttendeePreview((profiles || []).map((profile) => ({
        id: profile.user_id,
        name: profile.full_name || "Event attendee",
        avatarUrl: profile.avatar_url,
      })));
    } catch (error) {
      console.error("Could not load attendee preview:", error);
      setAttendeePreview([]);
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

      // The host-editable sections load with the event, so the page is not drawn before it is known what the host has hidden. The host reads
      // the table (every section, with its words); everyone else reads the public view, which gives the words of a visible section only.
      const sectionsRequest = fetchEventSections(eventData.id, !!user && user.id === eventData.created_by);

      const { data: profileData } = await supabase
        .from('public_profiles_safe')
        .select('user_id, full_name, avatar_url, role, bio, id_verified, verification_status, verification_tier, badge, level, website_url, instagram_url, twitter_url, linkedin_url, tiktok_url, behance_url, imdb_url, soundcloud_url, spotify_url, youtube_url, calendly_url')
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

      let viewerIsParticipant = false;
      if (user) {
        const { data: part } = await supabase
          .from('jam_participants').select('status').eq('jam_id', eventId).eq('user_id', user.id).maybeSingle();
        // 'cancelled' is a real stored status (so rsvp_to_event can tell a
        // fresh join from a rejoin), not "no participation" -- treat it the
        // same as no row at all, or a cancelled RSVP would still read as
        // truthy here and show "My pass" / "Cancel RSVP" for someone who
        // already left.
        const status = part && part.status !== 'cancelled' ? part.status : null;
        viewerIsParticipant = !!status;
        setParticipation(status);
      }
      await refreshAttendeePreview(
        eventId,
        eventData.attendee_list_visibility !== "host_only" || user?.id === eventData.created_by || viewerIsParticipant,
      );
      setSectionsLoaded(await sectionsRequest);
    } catch (err) {
      console.error('Error fetching event:', err);
      setEventLoadError(err instanceof Error ? err.message : "The event couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrSignup = async () => {
    if (!event || !availabilityReady || availabilityLoading || bookingDisabled) return;
    if (bookingState === "sign-in-waitlist") {
      navigate(buildEventAuthUrl(event.id));
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
        // The cancel function when the database has it, the direct update this was before when it does not: see lib/eventRsvp.
        const result = await cancelEventRsvp(event.id, user.id);
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
          await refreshAttendeePreview(event.id, true);
          setSuccessSequence((sequence) => sequence + 1);
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

  // Putting an event on the calendar (or taking it off) is its own action. It never RSVPs, reserves or counts, and the message says only what
  // the server confirmed.
  const toggleCalendar = async (targetId: string) => {
    if (!user) {
      navigate(buildEventAuthUrl(targetId));
      return;
    }
    if (calendarBusyId) return;
    const wasSaved = calendarIds.has(targetId);
    setCalendarBusyId(targetId);
    const result = wasSaved ? await removeFromKretopiaCalendar(user.id, targetId) : await addToKretopiaCalendar(user.id, targetId);
    setCalendarBusyId(null);
    if (result.ok === false) {
      if (result.reason === "unavailable") setCalendarAvailable(false);
      toast({ title: wasSaved ? "Not removed from your calendar" : "Not added to your calendar", description: result.message, variant: "destructive" });
      return;
    }
    setCalendarIds((previous) => {
      const next = new Set(previous);
      if (wasSaved) next.delete(targetId); else next.add(targetId);
      return next;
    });
    toast(wasSaved
      ? { title: "Removed from your Kretopia calendar", description: "Your RSVP, if you have one, is unchanged." }
      : { title: "Added to your Kretopia calendar", description: "This only puts it on your calendar. It does not RSVP you or reserve a place." });
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
  const bookingDisabled = !["available", "waitlist", "sign-in-waitlist"].includes(bookingState);
  const bookingLabel = getEventBookingLabel(bookingState);
  const bookingReason = bookingError || getEventBookingReason(bookingState);
  const cityLabel = event.event_mode && event.event_mode !== "irl"
    ? "Online"
    : event.venue_name || null;

  const spotsLeft = availabilityReady && capacity > 0 ? capacity - participantCount : null;
  const showScarcity = capacity > 0 && spotsLeft !== null && spotsLeft > 0 && spotsLeft / capacity < 0.3;
  // What the viewer may see of the host-editable sections: a visitor gets nothing of a hidden one, the host sees it marked.
  const sectionOf = (key: EventSectionKey) => viewSection(key, sectionsLoaded.sections[key], isCreator);
  const programView = sectionOf("program");
  const venueView = sectionOf("venue");
  const policiesView = sectionOf("policies");
  const faqView = sectionOf("faq");
  // Hiding the Venue section also keeps the address off this page's hero, its calendar exports and its structured data (the venue's name stays: it is the listing headline).
  // If the sections could not be read, a visitor is not shown the address either: it is not known whether the host hid it.
  const venueDetailsVisible = isCreator || (!sectionsLoaded.loadFailed && sectionsLoaded.sections.venue.visible);
  const publicVenueAddress = venueDetailsVisible ? event.venue_address || null : null;
  // Tickets sold elsewhere are their own action, apart from RSVP, and only while there is something to buy.
  const ticketUrl = hasExternalTicket && !isPast && !isCancelled && !isCompleted ? (event.external_ticket_url as string) : null;
  const calendarEvent: CalendarActionEvent = {
    id: event.id,
    title: event.title,
    description: event.description,
    startTime: event.start_time,
    endTime: event.end_time,
    venueName: event.venue_name,
    venueAddress: publicVenueAddress,
    url: `${APP_URL}/event/${event.id}`,
  };

  const downloadGuestList = async () => {
    const { data: parts } = await supabase
      .from("jam_participants")
      .select("user_id, guest_name, guest_email, status, joined_at")
      .eq("jam_id", event.id)
      .in("status", ["going", "interested", "maybe"]);
    const userIds = (parts || []).map((part: any) => part.user_id).filter(Boolean);
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("public_profiles_safe").select("user_id, full_name, role").in("user_id", userIds)
      : { data: [] };
    const profilesById = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
    const rows = [["Name", "Role", "Email", "Status", "Joined At"]];
    if (creator) rows.push([creator.full_name || "Host", creator.role || "", "", "Host", ""]);
    (parts || []).forEach((part: any) => {
      const profile = profilesById.get(part.user_id) as any;
      rows.push([
        profile?.full_name || part.guest_name || "Guest",
        profile?.role || (part.user_id ? "" : "Guest RSVP"),
        part.guest_email || "",
        part.status,
        part.joined_at ? new Date(part.joined_at).toLocaleDateString() : "",
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guest-list-${event.id.slice(0, 8)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Guest list downloaded" });
  };

  const markComplete = async () => {
    await supabase.from("creative_jams").update({ status: "completed" } as any).eq("id", event.id).eq("created_by", user?.id || "");
    toast({ title: "Event marked complete" });
    fetchEvent();
  };

  const cancelEvent = async () => {
    await supabase.from("creative_jams").update({ status: "cancelled" } as any).eq("id", event.id).eq("created_by", user?.id || "");
    toast({ title: "Event cancelled" });
    fetchEvent();
  };

  // The host's tools sit right under the header. Only the creator is given them; each write is still limited to the creator's own event by the server.
  const hostBar = isCreator ? (
    <EventHostBar
      isPast={isPast}
      isCompleted={isCompleted}
      isCancelled={isCancelled}
      onEdit={() => setShowEditDialog(true)}
      onEditSections={() => setShowSections(true)}
      onCheckIn={() => setShowCheckIn(true)}
      onShare={() => setShowShareKit(true)}
      onBackstage={() => navigate("/events/backstage")}
      onCohosts={() => setShowCohosts(true)}
      onRecap={() => setShowRecap(true)}
      onDownloadGuestList={downloadGuestList}
      onMarkComplete={markComplete}
      onCancelEvent={cancelEvent}
    />
  ) : null;

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
              ...(publicVenueAddress ? { "address": publicVenueAddress } : {})
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
      
      <EventPageShell
        eventTitle={event.title}
        hero={
          <>
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
              participantCount={availabilityReady ? participantCount : null}
              attendees={attendeePreview}
              attendeesVisible={event.attendee_list_visibility !== "host_only" || isCreator || !!participation}
              isFull={isFull}
              participation={participation}
              joining={joining}
              onShare={handleShare}
              onShowGuestPass={() => setShowGuestPass(true)}
              onCancelRsvp={handleJoin}
              calendarActions={
                <EventCalendarActions
                  event={calendarEvent}
                  signedIn={isAuthenticated}
                  saveAvailable={calendarAvailable}
                  saved={calendarIds.has(event.id)}
                  busy={calendarBusyId === event.id}
                  onToggleSaved={() => toggleCalendar(event.id)}
                  onSignIn={() => navigate(buildEventAuthUrl(event.id))}
                />
              }
              ticketUrl={ticketUrl}
              venueDetailsVisible={venueDetailsVisible}
              policiesVisible={policiesView.show}
              onGalleryChange={(urls) => setEvent((prev: any) => prev ? { ...prev, gallery_image_urls: urls } : prev)}
              onSignIn={() => navigate(buildEventAuthUrl(event.id))}
            />
            <div className={`${EVENT_PAGE_CONTENT_CLASS} space-y-3`}>
              {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("rsvp") === "confirmed" && (
                <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
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
                          <span className="font-medium text-foreground">{new URLSearchParams(window.location.search).get("email") || "your email"}</span>
                          . Here's the full event below.
                        </p>
                      </>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => navigate(`/event/${event.id}`, { replace: true })} aria-label="Dismiss">
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
              {isCancelled && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <p className="font-semibold text-destructive">Event Cancelled</p>
                    {event.status_note && <p className="text-sm text-muted-foreground">{event.status_note}</p>}
                  </div>
                </div>
              )}
              {isCompleted && (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3">
                  <Check className="h-5 w-5 shrink-0 text-green-600" aria-hidden />
                  <p className="font-semibold text-green-600">Event Completed</p>
                </div>
              )}
            </div>
          </>
        }
        about={
          <EventAboutSection
            description={event.description}
            hiddenFromVisitors={{
              program: programView.hiddenFromVisitors,
              venue: venueView.hiddenFromVisitors,
              policies: policiesView.hiddenFromVisitors,
              faq: faqView.hiddenFromVisitors,
            }}
            program={programView.show ? (
              programView.custom
                ? <SectionLines text={sectionsLoaded.sections.program.text} />
                : <p className="text-muted-foreground">No line-up or program details are listed for this event.</p>
            ) : null}
            venue={venueView.show ? (
              <>
                {event.event_mode && event.event_mode !== "irl" ? (
                  <p className="text-muted-foreground">Online event{event.online_format ? ` · ${event.online_format}` : ""}.</p>
                ) : (
                  <>
                    <p className="font-medium">{event.venue_name || "Location to be announced"}</p>
                    {isAuthenticated && publicVenueAddress && <p className="text-sm text-muted-foreground">{publicVenueAddress}</p>}
                    {!isAuthenticated && publicVenueAddress && <p className="text-sm text-muted-foreground">Sign in to see the full address.</p>}
                  </>
                )}
                {venueView.custom && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{sectionsLoaded.sections.venue.text}</p>}
              </>
            ) : null}
            policies={policiesView.show ? (
              policiesView.custom ? (
                <SectionLines text={sectionsLoaded.sections.policies.text} bullets />
              ) : (
                <>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>{event.require_account_for_rsvp ? "An account is required to RSVP." : "Guests may RSVP without creating an account."}</li>
                    <li>RSVP availability is confirmed by the event service; the displayed count is refreshed from the server.</li>
                    <li>{isTicketed && !hasExternalTicket ? "Online ticket sales are unavailable for this event." : "You can cancel an RSVP from this page while cancellation remains available."}</li>
                  </ul>
                  {event.status_note && <p className="text-sm text-muted-foreground">{event.status_note}</p>}
                </>
              )
            ) : null}
            faq={faqView.show ? (
              faqView.custom ? (
                <SectionFaq items={sectionsLoaded.sections.faq.faq} />
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">How do I RSVP?</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Use I'm Going. Your place is shown only after the server confirms it.</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Can I cancel?</h4>
                    <p className="mt-1 text-sm text-muted-foreground">If you're going, use Cancel RSVP on this page. The cancellation is confirmed by the event service.</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Where do I find the address?</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {!venueDetailsVisible
                        ? "The host hasn't shared the venue details on this page."
                        : event.venue_address && !isAuthenticated ? "Sign in to view the full address." : "Venue details are shown in the Venue block."}
                    </p>
                  </div>
                </div>
              )
            ) : null}
          />
        }
        attendees={
          <section id="attendees" aria-labelledby="event-attendees-heading" className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card p-4 md:p-6">
            <h2 id="event-attendees-heading" className="text-xl font-semibold">Who's coming</h2>
            <p className="text-sm text-muted-foreground">
              {availabilityReady ? `${participantCount} going` : "Attendance count unavailable"}
            </p>
            {availabilityReady ? (
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
            ) : <p className="text-sm text-muted-foreground" role="status">Attendance details are being checked.</p>}
          </section>
        }
        calendar={
          eventTimeValid ? (
            <EventCalendarWorkspace
              event={{
                ...event,
                creator_name: creator?.full_name || "Event host",
                participant_count: availabilityReady ? participantCount : 0,
                created_by: event.created_by,
              }}
              userId={user?.id || null}
              participation={participation}
              bookingDisabled={bookingDisabled}
              bookingReason={bookingReason}
              calendarOpen={showCalendar}
              onCalendarOpenChange={setShowCalendar}
              returnFocusRef={calendarReturnFocus}
              savedIds={calendarIds}
              saveAvailable={calendarAvailable}
              busyEventId={calendarBusyId}
              onToggleSaved={toggleCalendar}
              onSignIn={() => navigate(buildEventAuthUrl(event.id))}
              venueDetailsVisible={venueDetailsVisible}
            />
          ) : (
            <section id="schedule" aria-labelledby="event-schedule-heading" className="space-y-2 rounded-2xl border border-border bg-card p-4 md:p-6">
              <h2 id="event-schedule-heading" className="text-xl font-semibold">Schedule unavailable</h2>
              <p className="text-sm text-muted-foreground">The event time could not be verified, so calendar actions are unavailable.</p>
            </section>
          )
        }
        host={
          <div id="host" className="scroll-mt-24">
            <EventHostCard
              host={creator}
              isAuthenticated={isAuthenticated}
              onContactViaKretopia={(username) => username
                ? navigate(`/u/${username}`)
                : toast({ title: "Host contact unavailable", description: "This host has not shared a Kretopia username." })}
              onSignIn={() => navigate(buildEventAuthUrl(event.id))}
            />
          </div>
        }
        bookingRail={
          <>
            <EventBookingActions
              responsive
              label={bookingLabel}
              priceLabel={ticketPriceLabel}
              goingLabel={availabilityReady ? `${participantCount} going${capacity ? ` · ${capacity} places` : ""}` : "Attendance count unavailable"}
              reason={bookingReason}
              disabled={bookingDisabled}
              joining={joining}
              onBook={handleJoinOrSignup}
              ticketUrl={ticketUrl}
            />
          </>
        }
        hostTools={hostBar}
        afterHost={
          <div className="space-y-6">
            {event.event_mode && event.event_mode !== "irl" && !isPast && !isCancelled && (
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
            {(isPast || isCompleted) && event.photo_wall_enabled !== false && (
              <EventPhotoWall eventId={event.id} isHost={isCreator} canUpload={isCreator || !!participation} />
            )}
          </div>
        }
      />

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
              setSuccessSequence((sequence) => sequence + 1);
              refreshParticipantCount(event.id);
              refreshAttendeePreview(event.id, event.attendee_list_visibility !== "host_only" || !!user || isCreator);
            }}
          />

          <EventRsvpSuccessDialog
            successSequence={successSequence}
            event={{
              id: event.id,
              title: event.title,
              description: event.description,
              start_time: event.start_time,
              end_time: event.end_time,
              venue_name: event.venue_name,
              venue_address: event.venue_address,
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
            <EventSectionsDialog
              eventId={event.id}
              userId={user?.id ?? null}
              open={showSections}
              onOpenChange={setShowSections}
              loaded={sectionsLoaded}
              onSaved={(sections) => setSectionsLoaded((previous) => ({ ...previous, sections, available: true, loadFailed: false }))}
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
    </>
  );
};

export default EventPage;
