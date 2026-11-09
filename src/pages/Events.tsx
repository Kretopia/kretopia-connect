import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, MapPin, Calendar, Clock, Ticket,
  Search, Sparkles, Check, X, ChevronLeft, ChevronRight, Monitor,
} from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { KretoScene } from "@/components/brand/KretoScene";
import { CardPill, CardShell } from "@/components/cards/CardShell";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { eventTimeZone, formatEventTime } from "@/lib/eventTime";
import { formatCurrencyAmount } from "@/lib/currency";
import { CreateSessionDialog } from "@/components/sessions/CreateSessionDialog";
import { SessionDetailDialog } from "@/components/sessions/SessionDetailDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentGeoCountry } from "@/hooks/useCurrentGeoCountry";

export interface EventItem {
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
  creator_name: string;
  creator_avatar?: string;
  created_by: string;
  is_ticketed?: boolean;
  ticket_price?: number;
  ticket_currency?: string;
  event_type?: string;
  cover_image_url?: string;
  external_ticket_url?: string;
  status?: string;
  status_note?: string;
  event_mode?: string;
  my_status?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music', film: 'Film', photo: 'Photo', art: 'Art',
  podcast: '🎙Podcast', workshop: 'Workshop', networking: 'Networking',
  content: 'Content', festival: 'Festival', showcase: 'Showcase',
  general: 'Creative',
};

// Reduced to the handful people actually tap, inline as quick pills --
// replaces the old 8-option category dropdown buried in a filter sheet
// alongside three more filter dimensions (when/price/mode). Search now
// carries the rest of that job.
const QUICK_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'music', label: 'Music' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'networking', label: 'Networking' },
  { value: 'free', label: 'Free' },
];

const formatEventPrice = (event: EventItem) => {
  if (!event.is_ticketed) return "Free";
  if (event.ticket_price === 0) return "Free ticket";
  if (!event.ticket_price || event.ticket_price < 0) return "Ticket options · booking paused";
  return formatCurrencyAmount(event.ticket_price, event.ticket_currency) ?? "Paid event · currency unavailable";
};

export const EventCard = ({ event, onClick }: { event: EventItem; onClick: () => void }) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const isPast = new Date(event.start_time).getTime() < Date.now();
  const isFull = event.max_participants > 0 && event.participant_count >= event.max_participants;
  const isOnline = event.event_mode === "online" || event.event_type === "virtual";
  const place = isOnline ? "Online" : event.event_mode === "hybrid" ? "Hybrid" : event.venue_name || event.venue_address || "Location not listed";
  const booking = event.my_status === "going" ? "You're going" : event.status === "cancelled" ? "Cancelled" : isPast ? "Event ended" : isFull ? "Full" : event.max_participants > 0 ? "Places available" : "RSVP open";

  return (
    <CardShell
      flat
      title={event.title}
      open={{ onClick, ariaLabel: `View event: ${event.title}` }}
      cover={
        event.cover_image_url && !coverFailed
          ? <img src={event.cover_image_url} alt="" loading="lazy" decoding="async" onError={() => setCoverFailed(true)} className="h-full w-full object-cover" />
          : <KretoScene scene="soundstages" size="thumb" className="h-full w-full" />
      }
      coverStart={
        <>
          <CardPill tone="type">{CATEGORY_LABELS[event.category] || event.category}</CardPill>
          {isPast ? <CardPill>Past</CardPill> : null}
          {event.status === "cancelled" ? <CardPill>Cancelled</CardPill> : null}
        </>
      }
      meta={`By ${event.creator_name}`}
      description={event.description?.trim() || null}
      tags={[
        <CardPill key="time"><Clock className="h-3 w-3" aria-hidden /><span title={`Shown in your local timezone (${eventTimeZone()})`}>Your time · {formatEventTime(event.start_time)}</span></CardPill>,
        <CardPill key="place">{isOnline || event.event_mode === "hybrid" ? <Monitor className="h-3 w-3" aria-hidden /> : <MapPin className="h-3 w-3" aria-hidden />}{place}</CardPill>,
        <CardPill key="price"><Ticket className="h-3 w-3" aria-hidden />{formatEventPrice(event)} · {booking}</CardPill>,
      ]}
      primary={{
        label: event.my_status === "going" ? "View booking" : event.is_ticketed ? "View ticket options" : "View event & RSVP",
        onClick,
        ariaLabel: `View ${event.title} details`,
        disabled: event.status === "cancelled",
      }}
    />
  );
};

export function EventCalendar({
  events,
  month,
  selectedDay,
  onMonthChange,
  onSelectDay,
  onSelectEvent,
  onOpenFull,
  full = false,
}: {
  events: EventItem[];
  month: Date;
  selectedDay: Date;
  onMonthChange: (month: Date) => void;
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: EventItem) => void;
  onOpenFull?: () => void;
  full?: boolean;
}) {
  const calendarRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    calendarRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  }, [month, selectedDay]);
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(month)),
  });
  const dayEvents = events.filter((event) => isSameDay(new Date(event.start_time), selectedDay));

  return (
    <section ref={calendarRef} className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Event availability calendar">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onMonthChange(subMonths(month, 1)} aria-label="Previous month" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
          <h2 className="min-w-[9rem] text-center text-base font-semibold">{format(month, "MMMM yyyy")}</h2>
          <button type="button" onClick={() => onMonthChange(addMonths(month, 1)} aria-label="Next month" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="h-4 w-4" aria-hidden /></button>
        </div>
        {!full && onOpenFull && (
          <button type="button" onClick={onOpenFull} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Full calendar
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden="true">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label={`${format(month, "MMMM yyyy")} dates`}>
        {days.map((day) => {
          const count = events.filter((event) => isSameDay(new Date(event.start_time), day)).length;
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-label={`${format(day, "EEEE, MMMM d")}${count ? `, ${count} event${count === 1 ? "" : "s"}` : ", no events"}`}
              data-date={format(day, "yyyy-MM-dd")}
              aria-pressed={isSameDay(day, selectedDay)}
              onClick={() => onSelectDay(day)}
              onKeyDown={(event) => {
                const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : event.key === "ArrowDown" ? 7 : 0;
                if (!delta) return;
                event.preventDefault();
                const next = new Date(day);
                next.setDate(next.getDate() + delta);
                pendingFocus.current = format(next, "yyyy-MM-dd");
                if (!isSameMonth(next, month)) onMonthChange(startOfMonth(next));
                onSelectDay(next);
              }}
              className={`relative min-h-10 rounded-lg text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSameDay(day, selectedDay) ? "bg-primary font-semibold text-primary-foreground" : isSameMonth(day, month) ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {format(day, "d")}
              {count > 0 && <span aria-hidden className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSameDay(day, selectedDay) ? "bg-primary-foreground" : "bg-primary"}`} />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-semibold">{format(selectedDay, "EEEE, MMMM d")}</h3>
        {dayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events scheduled for this day.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dayEvents.map((event) => <EventCard key={event.id} event={event} onClick={() => onSelectEvent(event)} />)}
          </div>
        )}
      </div>
    </section>
  );
}

const Events = ({ embedded }: { embedded?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { geo: currentGeo } = useCurrentGeoCountry();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myEvents, setMyEvents] = useState<EventItem[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<EventItem[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [calendarDay, setCalendarDay] = useState(() => new Date());
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    initialTab === "hosting" || initialTab === "joined" ? initialTab : "browse"
  );

  // Sync if user navigates with a different ?tab= while page is mounted
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "hosting" || t === "joined" || t === "browse") setActiveTab(t);
  }, [searchParams]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [hostingTime, setHostingTime] = useState<"upcoming" | "past">("upcoming");
  const [joinedTime, setJoinedTime] = useState<"upcoming" | "past">("upcoming");

  const splitByTime = (list: EventItem[]) => {
    const now = Date.now();
    const upcoming: EventItem[] = [];
    const past: EventItem[] = [];
    list.forEach(e => {
      const t = new Date(e.end_time || e.start_time).getTime();
      if (t >= now) upcoming.push(e); else past.push(e);
    });
    // sort: upcoming asc, past desc
    upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    past.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    return { upcoming, past };
  };

  const handleEventClick = (event: EventItem) => {
    // For non-authenticated users, navigate to public event page
    if (!user) {
      navigate(`/event/${event.id}`);
      return;
    }
    setSelectedEvent(event);
  };

  const handleHostEvent = () => {
    if (!user) {
      navigate('/auth?redirect=/scene');
      return;
    }
    setShowCreate(true);
  };

  const changeCalendarMonth = (month: Date) => {
    const first = startOfMonth(month);
    setCalendarMonth(first);
    setCalendarDay(first);
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // Resolve user country: GPS first, fall back to profile.location
      let userCountry: string | null = currentGeo?.country || null;
      if (!userCountry && user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('location')
          .eq('user_id', user.id)
          .maybeSingle();
        const loc = (prof as any)?.location || '';
        const parts = String(loc).split(',').map((s: string) => s.trim()).filter(Boolean);
        userCountry = parts.length > 1 ? parts[parts.length - 1] : null;
      }

      // Public browse: fetch events even without auth
      let query = supabase
        .from('creative_jams')
        .select('*, profiles!creative_jams_created_by_fkey (full_name, avatar_url)')
        .eq('is_public', true)
        .in('status', ['upcoming', 'active'])
        .gte('start_time', new Date().toISOString());

      // If we know user's country, prioritize that country + untagged events
      if (userCountry) {
        query = query.or(`country.eq.${userCountry},country.is.null`);
      }

      const { data: allEvents, error: eventsError } = await query
        .order('start_time', { ascending: true })
        .limit(50);
      if (eventsError) throw eventsError;

      const sessionIds = allEvents?.map(s => s.id) || [];
      const { data: counts, error: countsError } = await supabase
        .from('jam_participants')
        .select('jam_id')
        .in('jam_id', sessionIds.length ? sessionIds : ['none'])
        .eq('status', 'going');
      if (countsError) throw countsError;

      const countMap: Record<string, number> = {};
      counts?.forEach(c => { countMap[c.jam_id] = (countMap[c.jam_id] || 0) + 1; });

      const ownStatus: Record<string, string> = {};
      if (user && sessionIds.length) {
        const { data: ownRows, error: ownError } = await supabase
          .from('jam_participants')
          .select('jam_id, status')
          .eq('user_id', user.id)
          .in('jam_id', sessionIds);
        if (ownError) throw ownError;
        ownRows?.forEach(row => { ownStatus[row.jam_id] = row.status; });
      }

      setEvents((allEvents || []).map(s => ({
        ...s,
        participant_count: countMap[s.id] || 0,
        creator_name: (s.profiles as any)?.full_name || 'Unknown',
        creator_avatar: (s.profiles as any)?.avatar_url,
        my_status: ownStatus[s.id] || null,
      })));

      // Only fetch user-specific data if logged in
      if (!user) {
        setMyEvents([]);
        setJoinedEvents([]);
        return;
      }

      // My created events (all — past + upcoming)
      const { data: mine, error: mineError } = await supabase
        .from('creative_jams')
        .select('*')
        .eq('created_by', user.id)
        .order('start_time', { ascending: false });
      if (mineError) throw mineError;

      const myIds = mine?.map(s => s.id) || [];
      const { data: myCounts, error: myCountsError } = await supabase
        .from('jam_participants')
        .select('jam_id')
        .in('jam_id', myIds.length ? myIds : ['none'])
        .eq('status', 'going');
      if (myCountsError) throw myCountsError;

      const myCountMap: Record<string, number> = {};
      myCounts?.forEach(c => { myCountMap[c.jam_id] = (myCountMap[c.jam_id] || 0) + 1; });

      setMyEvents((mine || []).map(s => ({
        ...s,
        participant_count: myCountMap[s.id] || 0,
        creator_name: 'You',
      })));

      // Joined events
      const { data: participations, error: participationError } = await supabase
        .from('jam_participants')
        .select('jam_id, status, creative_jams (*, profiles!creative_jams_created_by_fkey (full_name, avatar_url))')
        .eq('user_id', user.id);
      if (participationError) throw participationError;

      const joined: EventItem[] = [];
      participations?.forEach(p => {
        if (p.creative_jams) {
          const session = p.creative_jams as any;
          joined.push({
            ...session,
            participant_count: 0,
            creator_name: session.profiles?.full_name || 'Unknown',
            creator_avatar: session.profiles?.avatar_url,
            my_status: p.status,
          });
        }
      });
      setJoinedEvents(joined);
    } catch (error) {
      console.error('Error fetching events:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user, currentGeo?.country]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filteredEvents = events.filter(e => {
    const matchesSearch = !searchQuery ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.venue_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.creator_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesQuickFilter =
      categoryFilter === 'all' ||
      (categoryFilter === 'free' ? !(e.is_ticketed && (e.ticket_price || 0) > 0) : e.category === categoryFilter);
    return matchesSearch && matchesQuickFilter;
  });

  return (
    <>
      {!embedded && (
        <Helmet>
          <title>Events & Meetups | Kretopia</title>
          <meta name="description" content="Discover creative events, jam sessions, workshops, and meetups near you. Host your own or join the community." />
        </Helmet>
      )}

      <div className={embedded ? "" : "min-h-screen bg-background"}>
        <div className={embedded ? "" : "max-w-2xl mx-auto px-4 pt-4 pb-24"}>
          {/* Header */}
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="min-w-0">
              {!embedded && (
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  What's on
                </h1>
              )}
              <p className="text-sm text-muted-foreground">
                Upcoming creative gatherings
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/events/backstage")}
                  className="gap-1.5 rounded-full"
                  title="Manage your events"
                >
                  <Sparkles className="h-4 w-4" /> Backstage
                </Button>
              )}
              <Button variant="gradient" size="sm" onClick={handleHostEvent} className="gap-1.5 rounded-full">
                <Plus className="h-4 w-4" /> Host one
              </Button>
            </div>
          </div>

          {/* Search — same visual system as the landing page's hero search:
              glass pill, ambient breathing glow, top-edge scan-line. Replaces
              the old plain input + a "Filter" button that opened a sheet with
              four separate filter dimensions (category/when/price/mode) —
              search now carries that job, backed by a handful of quick
              category pills below instead of a hidden multi-step sheet. */}
          <div className="relative mb-3">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-2 rounded-[22px] blur-xl opacity-70 ai-ambient-breathe"
              style={{ background: "radial-gradient(60% 100% at 50% 50%, hsl(var(--energy)/0.22), transparent 70%)" }}
            />
            <div aria-hidden className="pointer-events-none absolute inset-x-3 top-0 h-px overflow-hidden rounded-full">
              <div
                className="ai-scan-line h-full w-1/3"
                style={{ background: "linear-gradient(90deg, transparent, hsl(var(--energy)), transparent)" }}
              />
            </div>
            <div className="relative flex items-center gap-2.5 rounded-full border border-border bg-card/90 backdrop-blur-sm px-4 h-14 shadow-lg shadow-black/5">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search what's on, venues, hosts..."
                className="flex-1 min-w-0 bg-transparent outline-none text-base placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick category pills — 5 total, always visible, one tap each.
              No modal, no hidden dimensions. */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
            {QUICK_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setCategoryFilter(f.value)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  categoryFilter === f.value
                    ? "bg-[hsl(var(--energy))] text-[hsl(var(--energy-foreground))]"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <button
              type="button"
              aria-expanded={calendarExpanded}
              aria-controls="events-availability-calendar"
              onClick={() => setCalendarExpanded((value) => !value)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Calendar className="h-4 w-4 text-primary" aria-hidden />
              {calendarExpanded ? "Hide calendar" : "Browse calendar"}
            </button>
            {calendarExpanded && (
              <div id="events-availability-calendar" className="mt-3">
                {loading ? (
                  <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground" aria-busy="true">
                    <KretopiaSpinner className="mx-auto mb-2 h-4 w-4" />Loading availability…
                  </div>
                ) : loadError ? (
                  <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
                    <p className="font-semibold">Couldn't load event availability.</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={fetchEvents}>Retry</Button>
                  </div>
                ) : <EventCalendar
                  events={filteredEvents}
                  month={calendarMonth}
                  selectedDay={calendarDay}
                  onMonthChange={changeCalendarMonth}
                  onSelectDay={(day) => {
                    setCalendarDay(day);
                    if (!isSameMonth(day, calendarMonth)) setCalendarMonth(startOfMonth(day));
                  }}
                  onSelectEvent={(event) => {
                    setCalendarOpen(false);
                    handleEventClick(event);
                  }}
                  onOpenFull={() => setCalendarOpen(true)}
                />
                }
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="browse" className="flex-1">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> What's on
              </TabsTrigger>
              {user && (
                <>
                  <TabsTrigger value="joined" className="flex-1">
                    <Check className="h-3.5 w-3.5 mr-1.5" /> My plans
                  </TabsTrigger>
                  <TabsTrigger value="hosting" className="flex-1">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" /> I'm hosting
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="browse" className="mt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Card key={i}><CardContent className="p-4 space-y-3 animate-pulse">
                      <div className="h-40 rounded-lg bg-muted" />
                      <div className="h-5 w-3/4 rounded bg-muted" />
                      <div className="h-4 w-1/2 rounded bg-muted" />
                      <div className="flex gap-2">
                        <div className="h-6 w-16 rounded-full bg-muted" />
                        <div className="h-6 w-20 rounded-full bg-muted" />
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              ) : loadError ? (
                <EmptyState
                  icon={Sparkles}
                  eyebrow="Events"
                  title="Couldn't load events"
                  description="Your events and availability could not be refreshed."
                  action={{ label: "Try again", icon: Calendar, onClick: fetchEvents }}
                />
              ) : filteredEvents.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  eyebrow="Be the catalyst"
                  title="No events found"
                  description="The best events start with one host stepping up. Be the first creative gathering in your area."
                  action={{ label: "Host an Event", icon: Plus, onClick: handleHostEvent }}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredEvents.map(event => (
                    <EventCard key={event.id} event={event} onClick={() => handleEventClick(event)} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="joined" className="mt-0">
              {(() => {
                const { upcoming, past } = splitByTime(joinedEvents);
                const list = joinedTime === "upcoming" ? upcoming : past;
                return (
                  <div className="space-y-3">
                    <div className="inline-flex rounded-full border bg-muted/40 p-0.5">
                      <button
                        onClick={() => setJoinedTime("upcoming")}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${joinedTime === "upcoming" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                      >Upcoming ({upcoming.length})</button>
                      <button
                        onClick={() => setJoinedTime("past")}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${joinedTime === "past" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                      >Past ({past.length})</button>
                    </div>
                    {list.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                          <p className="font-semibold mb-1">
                            {joinedTime === "upcoming" ? "Nothing on your calendar yet" : "No past events"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {joinedTime === "upcoming" ? "Browse what's on and save your spot" : "Events you attend will show up here"}
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {list.map(event => (
                          <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="hosting" className="mt-0">
              {(() => {
                const { upcoming, past } = splitByTime(myEvents);
                const list = hostingTime === "upcoming" ? upcoming : past;
                return (
                  <div className="space-y-3">
                    <div className="inline-flex rounded-full border bg-muted/40 p-0.5">
                      <button
                        onClick={() => setHostingTime("upcoming")}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${hostingTime === "upcoming" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                      >Upcoming ({upcoming.length})</button>
                      <button
                        onClick={() => setHostingTime("past")}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${hostingTime === "past" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                      >Past ({past.length})</button>
                    </div>
                    {list.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                          <p className="font-semibold mb-1">
                            {hostingTime === "upcoming" ? "You're not hosting anything yet" : "No past events yet"}
                          </p>
                          <p className="text-sm text-muted-foreground mb-4">
                            {hostingTime === "upcoming" ? "Bring people together — your community is waiting" : "Once you wrap an event, it'll show up here"}
                          </p>
                          {hostingTime === "upcoming" && (
                            <Button variant="gradient" onClick={() => setShowCreate(true)}>
                              <Plus className="h-4 w-4 mr-2" /> Host your first
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {list.map(event => (
                          <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CreateSessionDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchEvents} />

      <SessionDetailDialog
        session={selectedEvent} 
        open={!!selectedEvent} 
        onOpenChange={(open) => !open && setSelectedEvent(null)} 
        onRefresh={fetchEvents}
      />
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="!inset-0 !left-0 !top-0 !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto rounded-none border-0 p-3 sm:p-5 md:!left-1/2 md:!top-1/2 md:!h-[min(90dvh,900px)] md:!w-[min(1200px,calc(100vw-2rem))] md:!-translate-x-1/2 md:!-translate-y-1/2 md:rounded-2xl">
          <DialogTitle className="sr-only">Event availability calendar</DialogTitle>
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground" aria-busy="true"><KretopiaSpinner className="mx-auto mb-2 h-4 w-4" />Loading availability…</div>
          ) : loadError ? (
            <div role="alert" className="m-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
              <p className="font-semibold">Couldn't load event availability.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={fetchEvents}>Retry</Button>
            </div>
          ) : <EventCalendar
            events={filteredEvents}
            month={calendarMonth}
            selectedDay={calendarDay}
            onMonthChange={changeCalendarMonth}
            onSelectDay={(day) => {
              setCalendarDay(day);
              if (!isSameMonth(day, calendarMonth)) setCalendarMonth(startOfMonth(day));
            }}
            onSelectEvent={(event) => {
              setCalendarOpen(false);
              handleEventClick(event);
            }}
            full
          />
          }
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Events;
