import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Loader2, MapPin, Calendar, Clock, Users, Ticket,
  Search, Sparkles, Share2, Check, X
} from "lucide-react";
import { format } from "date-fns";
import { CreateSessionDialog } from "@/components/sessions/CreateSessionDialog";
import { SessionDetailDialog } from "@/components/sessions/SessionDetailDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentGeoCountry } from "@/hooks/useCurrentGeoCountry";

interface EventItem {
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

const EventCard = ({ event, onClick }: { event: EventItem; onClick: () => void }) => {
  const startDate = new Date(event.start_time);
  const isPast = startDate < new Date();
  const isTicketed = event.is_ticketed && event.ticket_price && event.ticket_price > 0;
  const currencySymbol = CURRENCY_SYMBOLS[event.ticket_currency || 'USD'] || '$';
  const spotsLeft = event.max_participants - event.participant_count;
  const isHot = event.participant_count >= 5;
  const isSoon = !isPast && (startDate.getTime() - Date.now()) < 48 * 60 * 60 * 1000;

  return (
    <div 
      className={`flex gap-3 p-3 rounded-xl border bg-card hover:bg-accent/5 cursor-pointer transition-all hover:shadow-md group ${
        isSoon ? "border-primary/30 shadow-sm shadow-primary/5" : "border-border/50"
      }`}
      onClick={onClick}
    >
      {/* Cover image or date block */}
      {event.cover_image_url ? (
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden shrink-0">
          <img src={event.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          {isTicketed && (
            <Badge className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
              {currencySymbol}{event.ticket_price}
            </Badge>
          )}
        </div>
      ) : (
        <div className="w-16 h-24 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
          <span className="text-xs font-medium text-primary uppercase">{format(startDate, "MMM")}</span>
          <span className="text-2xl font-bold text-primary">{format(startDate, "d")}</span>
        </div>
      )}
      
      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="h-3 w-3" />
            <span>{format(startDate, "EEE, MMM d · h:mm a")}</span>
          </div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground">By {event.creator_name}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {event.venue_name && (
              <span className="flex items-center gap-1 truncate max-w-[120px]">
                <MapPin className="h-3 w-3 shrink-0" /> {event.venue_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isHot && (
              <Badge className="text-[10px] py-0 px-1.5 bg-orange-500/10 text-orange-600 border-0">Hot</Badge>
            )}
            {isSoon && !isPast && (
              <Badge className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-0">Soon</Badge>
            )}
            {spotsLeft <= 5 && spotsLeft > 0 && !isPast && (
              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">{spotsLeft} left</Badge>
            )}
            {spotsLeft <= 0 && !isPast && (
              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Full</Badge>
            )}
            {!isTicketed && !isPast && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Free</Badge>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{event.participant_count}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Featured horizontal scroller for events with cover images
const FeaturedEvents = ({ events, onSelect }: { events: EventItem[]; onSelect: (e: EventItem) => void }) => {
  const featured = events.filter(e => e.cover_image_url);
  if (featured.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {featured.slice(0, 8).map(event => {
          const startDate = new Date(event.start_time);
          const isTicketed = event.is_ticketed && event.ticket_price && event.ticket_price > 0;
          const currencySymbol = CURRENCY_SYMBOLS[event.ticket_currency || 'USD'] || '$';
          
          return (
            <div 
              key={event.id}
              className="shrink-0 w-[200px] rounded-xl overflow-hidden border border-border/50 cursor-pointer group hover:shadow-lg transition-all"
              onClick={() => onSelect(event)}
            >
              <div className="relative h-28">
                <img src={event.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{event.title}</p>
                </div>
                {isTicketed && (
                  <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px]">
                    {currencySymbol}{event.ticket_price}
                  </Badge>
                )}
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-xs text-muted-foreground">{format(startDate, "EEE, MMM d · h:mm a")}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">By {event.creator_name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Users className="h-3 w-3" /> {event.participant_count}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Events = ({ embedded }: { embedded?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { geo: currentGeo } = useCurrentGeoCountry();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myEvents, setMyEvents] = useState<EventItem[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<EventItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
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

  const fetchEvents = useCallback(async () => {
    setLoading(true);
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

      const { data: allEvents } = await query
        .order('start_time', { ascending: true })
        .limit(50);

      const sessionIds = allEvents?.map(s => s.id) || [];
      const { data: counts } = await supabase
        .from('jam_participants')
        .select('jam_id')
        .in('jam_id', sessionIds.length ? sessionIds : ['none'])
        .in('status', ['going', 'interested']);

      const countMap: Record<string, number> = {};
      counts?.forEach(c => { countMap[c.jam_id] = (countMap[c.jam_id] || 0) + 1; });

      setEvents((allEvents || []).map(s => ({
        ...s,
        participant_count: countMap[s.id] || 0,
        creator_name: (s.profiles as any)?.full_name || 'Unknown',
        creator_avatar: (s.profiles as any)?.avatar_url,
      })));

      // Only fetch user-specific data if logged in
      if (!user) return;

      // My created events (all — past + upcoming)
      const { data: mine } = await supabase
        .from('creative_jams')
        .select('*')
        .eq('created_by', user.id)
        .order('start_time', { ascending: false });

      const myIds = mine?.map(s => s.id) || [];
      const { data: myCounts } = await supabase
        .from('jam_participants')
        .select('jam_id')
        .in('jam_id', myIds.length ? myIds : ['none'])
        .in('status', ['going', 'interested']);

      const myCountMap: Record<string, number> = {};
      myCounts?.forEach(c => { myCountMap[c.jam_id] = (myCountMap[c.jam_id] || 0) + 1; });

      setMyEvents((mine || []).map(s => ({
        ...s,
        participant_count: myCountMap[s.id] || 0,
        creator_name: 'You',
      })));

      // Joined events
      const { data: participations } = await supabase
        .from('jam_participants')
        .select('jam_id, status, creative_jams (*, profiles!creative_jams_created_by_fkey (full_name, avatar_url))')
        .eq('user_id', user.id);

      const joined: EventItem[] = [];
      participations?.forEach(p => {
        if (p.creative_jams) {
          const session = p.creative_jams as any;
          joined.push({
            ...session,
            participant_count: 0,
            creator_name: session.profiles?.full_name || 'Unknown',
            creator_avatar: session.profiles?.avatar_url,
          });
        }
      });
      setJoinedEvents(joined);
    } catch (error) {
      console.error('Error fetching events:', error);
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

  const upcomingCount = events.length;

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
                {upcomingCount > 0
                  ? `${upcomingCount} happening soon · ${events.filter(e => e.participant_count >= 5).length} trending`
                  : "Real-life moments with the creative community"}
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
                    ? "bg-[hsl(var(--energy))] text-white"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
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
              ) : filteredEvents.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  eyebrow="Be the catalyst"
                  title="No events found"
                  description="The best events start with one host stepping up. Be the first creative gathering in your area."
                  action={{ label: "Host an Event", icon: Plus, onClick: handleHostEvent }}
                />
              ) : (
                <div className="space-y-2">
                  <FeaturedEvents events={filteredEvents} onSelect={handleEventClick} />
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
    </>
  );
};

export default Events;
