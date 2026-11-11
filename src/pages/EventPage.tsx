import { csvCell } from "@/lib/csvCell";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sendEventConfirmationEmail } from "@/utils/eventConfirmationEmail";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, Check, Share2, ExternalLink, XCircle,
  ChevronDown
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
import type { EventAttendeePreview } from "@/components/sessions/EventAttendeeStack";
import { EventBookingBlock, type RsvpNotice } from "@/components/sessions/EventBookingBlock";
import { EventGallery } from "@/components/sessions/EventGallery";
import { EventHostBar } from "@/components/sessions/EventHostBar";
import { EventCalendarActions, type CalendarActionEvent } from "@/components/sessions/EventCalendarActions";
import { EventSectionsDialog } from "@/components/sessions/EventSectionsDialog";
import { SectionFaq, SectionLines } from "@/components/sessions/EventSectionContent";
import { EventCommunityHub } from "@/components/sessions/EventCommunityHub";
import { EventPageShell } from "@/components/sessions/EventPageShell";
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
import { getEventBookingControl, getEventBookingReason, getEventBookingState } from "@/lib/eventBookingState";
import { participantVisibilityFilter, participantVisibleTo } from "@/lib/eventParticipantVisibility";
import { publicPassportPath } from "@/lib/passport/passportNav";
import { addToKretopiaCalendar, fetchCalendarEntries, removeFromKretopiaCalendar } from "@/lib/eventCalendar";
import { emptySections, fetchEventSections, viewSection, type EventSectionKey, type FetchedSections } from "@/lib/eventSections";
import { APP_URL } from "@/lib/constants";

const EventPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
  // What the last RSVP action did, said once in the booking block (no toast and no dialog repeat it).
  const [rsvpNotice, setRsvpNotice] = useState<RsvpNotice | null>(null);
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
            setRsvpNotice({ tone: "success", text: "Ticket confirmed. You're on the guest list." });
            fetchEvent();
          } else {
            setRsvpNotice({ tone: "info", text: "Processing your payment. We'll confirm shortly." });
          }
        } catch {
          // silent
        } finally {
          // Clean URL
          window.history.replaceState({}, "", `/event/${eventId}`);
        }
      })();
    } else if (ticketStatus === "cancelled") {
      setRsvpNotice({ tone: "error", text: "Checkout cancelled." });
      window.history.replaceState({}, "", `/event/${eventId}`);
    }
  }, [eventId]);

  // A guest lands here from the RSVP form with ?rsvp=confirmed: that is the same one message, not a banner of its own. The message is
  // kept in the page and the address is cleaned at once, so the guest's name, email and pass token are not left in the address bar to be
  // copied or shared along with the link to the event.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("rsvp") !== "confirmed") return;
    const name = params.get("name");
    const email = params.get("email");
    setRsvpNotice(params.get("source") === "email"
      ? { tone: "success", text: `Attendance confirmed. Great to have you${name ? `, ${name}` : ""}. Your spot is locked in.` }
      : { tone: "success", text: `You're going. We're sending a confirmation to ${email || "your email"}.` });
    navigate({ pathname: location.pathname, hash: location.hash }, { replace: true });
  }, [location.search, location.pathname, location.hash, navigate]);

  const dismissRsvpNotice = () => setRsvpNotice(null);

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

  // The faces in the avatar stack. `hostId` is the event's host: the host sees every member, anyone else only the members who have not
  // hidden themselves from the attendee list (and themselves), by the one rule in lib/eventParticipantVisibility.
  const refreshAttendeePreview = async (id: string, canView: boolean, hostId: string) => {
    if (!canView) {
      setAttendeePreview([]);
      return;
    }
    try {
      const viewerId = user?.id ?? null;
      const viewerIsHost = !!viewerId && viewerId === hostId;
      let query = supabase
        .from("jam_participants")
        .select("user_id, is_visible")
        .eq("jam_id", id)
        .eq("status", "going")
        .not("user_id", "is", null);
      const visibility = participantVisibilityFilter(viewerId, viewerIsHost);
      if (visibility) query = query.or(visibility);
      const { data: rows, error } = await query.limit(3);
      if (error) throw error;
      const userIds = [...new Set((rows || [])
        .filter((row) => participantVisibleTo(row, viewerId, viewerIsHost))
        .map((row) => row.user_id)
        .filter((value): value is string => !!value))];
      if (!userIds.length) {
        setAttendeePreview([]);
        return;
      }
      const { data: profiles, error: profileError } = await supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      if (profileError) throw profileError;
      // Built from the ids this viewer may see, in their order: a profile that was not asked for is never drawn.
      const profileOf = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      setAttendeePreview(userIds.flatMap((userId) => {
        const profile = profileOf.get(userId);
        return profile ? [{ id: userId, name: profile.full_name || "Event attendee", avatarUrl: profile.avatar_url }] : [];
      }));
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

      setCreator({ ...((profileData ?? {}) as Record<string, unknown>), username: hostUsername?.username, hostedCount: hostedCount || 0 });

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
        eventData.created_by,
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

  // What the server stored for this viewer: their row (a cancelled one reads as no status), null when there is no row, and "unreadable"
  // when the read itself failed (the caller then keeps the answer the RSVP call gave).
  const readOwnParticipation = async (eventId: string, userId: string): Promise<{ id: string; status: string | null } | null | "unreadable"> => {
    const { data, error } = await supabase
      .from('jam_participants').select('id, status').eq('jam_id', eventId).eq('user_id', userId).maybeSingle();
    if (error) return "unreadable";
    if (!data) return null;
    return { id: data.id, status: data.status && data.status !== 'cancelled' ? data.status : null };
  };

  const handleJoin = async () => {
    if (!user || !event || joinInFlight.current || (!availabilityReady && !participation) || (bookingDisabled && !participation)) return;
    joinInFlight.current = true;
    setJoining(true);
    setRsvpNotice(null);
    try {
      if (participation) {
        const wasWaitlisted = participation === 'waitlisted';
        // The cancel function when the database has it, the direct update this was before when it does not: see lib/eventRsvp.
        const result = await cancelEventRsvp(event.id, user.id);
        if (result === 'not_going') throw new Error("Your RSVP could not be found. Refresh and try again.");
        setParticipation(null);
        await refreshParticipantCount(event.id);
        await refreshAttendeePreview(event.id, event.attendee_list_visibility !== "host_only" || user.id === event.created_by, event.created_by);
        setRsvpNotice({
          tone: "info",
          text: wasWaitlisted ? "You've left the waitlist." : "Your RSVP is cancelled. Your spot has been released.",
        });
      } else {
        // Capture promoter/host attribution from ?ref= query
        const referredBy = await captureRefFromUrl(event.id);
        const { data: result, error } = await supabase.rpc('rsvp_to_event', {
          p_event_id: event.id,
          p_referred_by: referredBy && referredBy !== user.id ? referredBy : null,
          p_referral_channel: referredBy && referredBy !== user.id ? 'link' : null,
        });
        if (error) throw error;

        if (result === 'full_no_waitlist') {
          await refreshParticipantCount(event.id);
          setRsvpNotice({ tone: "error", text: "This event is full, and the host hasn't opened a waitlist." });
        } else if (result === 'waitlisted' || result === 'already' || result === 'joined') {
          // The notice says what the server stored for this viewer, not just what the call answered. The row is also what the
          // confirmation email is sent for, so a read that failed is tried once more before the email is given up on.
          let stored = await readOwnParticipation(event.id, user.id);
          if (stored === "unreadable") stored = await readOwnParticipation(event.id, user.id);
          const status = stored && stored !== "unreadable" ? stored.status : result === 'waitlisted' ? 'waitlisted' : 'going';
          setParticipation(status);
          await refreshParticipantCount(event.id);
          if (status === 'waitlisted') {
            setRsvpNotice({ tone: "success", text: "You're on the waitlist. We'll let you know the moment a place opens." });
          } else if (status === 'going' && result === 'already') {
            setRsvpNotice({ tone: "info", text: "You're already on the guest list." });
          } else if (status === 'going') {
            setRsvpNotice({ tone: "success", text: "You're going. Your place is confirmed." });
          } else {
            throw new Error("The event did not confirm your RSVP.");
          }
          if (result === 'joined' && status === 'going') {
            await refreshAttendeePreview(event.id, true, event.created_by);
            // The confirmation email is sent once, for the row the server just stored.
            if (stored && stored !== "unreadable") {
              sendEventConfirmationEmail({
                eventId: event.id,
                eventTitle: event.title,
                startTime: event.start_time,
                endTime: event.end_time,
                venueName: event.venue_name,
                venueAddress: event.venue_address,
                isTicketed: false,
                participantId: stored.id,
              }).catch(() => {});
            }
          }
        } else {
          throw new Error("The event did not confirm your RSVP.");
        }
      }
    } catch (err) {
      console.error('RSVP error:', err);
      setRsvpNotice({ tone: "error", text: err instanceof Error ? err.message : "Failed to update RSVP." });
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
  const bookingControl = getEventBookingControl(bookingState);
  const bookingReason = getEventBookingReason(bookingState);
  const eventIsOnline = !!event.event_mode && event.event_mode !== "irl";
  // The host's visibility setting, applied once: the host and anyone with a place always see who is going.
  const attendeesVisible = event.attendee_list_visibility !== "host_only" || isCreator || !!participation;

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
    const csv = rows.map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n");
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
          <EventHeroCard
            event={event}
            hasPass={!!user && !!participation}
            onShare={handleShare}
            onShowGuestPass={() => setShowGuestPass(true)}
          />
        }
        booking={
          <EventBookingBlock
            eventId={event.id}
            eventTitle={event.title}
            startTime={event.start_time}
            countdown={countdown}
            isPast={isPast}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
            isOnline={eventIsOnline}
            onlineFormat={event.online_format}
            venueName={event.venue_name || null}
            venueAddress={publicVenueAddress}
            venueDetailsVisible={venueDetailsVisible}
            isAuthenticated={isAuthenticated}
            isHost={isCreator}
            viewerId={user?.id ?? null}
            priceLabel={ticketPriceLabel}
            ticketUrl={ticketUrl}
            capacity={capacity}
            participantCount={availabilityReady ? participantCount : null}
            attendees={attendeePreview}
            attendeesVisible={attendeesVisible}
            control={bookingControl}
            reason={bookingState === "cancelled" ? null : bookingReason}
            joining={joining}
            rsvpNotice={rsvpNotice}
            onDismissNotice={dismissRsvpNotice}
            onBook={handleJoinOrSignup}
            onCancelRsvp={handleJoin}
            calendarAction={
              <EventCalendarActions
                event={calendarEvent}
                signedIn={isAuthenticated}
                saveAvailable={calendarAvailable}
                saved={calendarIds.has(event.id)}
                busy={calendarBusyId === event.id}
                onToggleSaved={() => toggleCalendar(event.id)}
                onSignIn={() => navigate(buildEventAuthUrl(event.id))}
                size="default"
                labelAlways
                className="w-full justify-start"
              />
            }
            host={creator}
            onContactHost={() => navigate(publicPassportPath(event.created_by))}
            policiesVisible={policiesView.show}
            onSignIn={() => navigate(buildEventAuthUrl(event.id))}
            bottomNav={isAuthenticated}
          />
        }
        notices={(isCancelled || isCompleted) ? (
          <div className="space-y-3">
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
        ) : null}
        hostTools={hostBar}
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
                  {/* A cancelled event's note is in the notice at the top of the page; it is not said again here. */}
                  {event.status_note && !isCancelled && <p className="text-sm text-muted-foreground">{event.status_note}</p>}
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
        gallery={
          <EventGallery
            eventId={event.id}
            urls={event.gallery_image_urls || []}
            isCreator={isCreator}
            onChange={(urls) => setEvent((prev: Record<string, unknown> | null) => prev ? { ...prev, gallery_image_urls: urls } : prev)}
          />
        }
        crew={
          <section id="attendees" aria-labelledby="event-attendees-heading" className="scroll-mt-24">
            <h2 id="event-attendees-heading" className="sr-only">Who's coming</h2>
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
        afterCrew={
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
              // The one confirmation is the notice that the ?rsvp=confirmed landing feeds; here only the page's numbers catch up with the server.
              setParticipation('going');
              refreshParticipantCount(event.id);
              refreshAttendeePreview(event.id, event.attendee_list_visibility !== "host_only" || !!user || isCreator, event.created_by);
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
