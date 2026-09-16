import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, MapPin, Search, X, ArrowRight, Plus, Sparkles, Ticket, Users, TrendingUp, Globe, Settings as SettingsIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { escapePostgrestValue } from "@/lib/postgrestFilter";
import { CreateSessionDialog } from "@/components/sessions/CreateSessionDialog";
import { AIHostEventCard } from "@/components/sessions/AIHostEventCard";
import type { ScannedEventDetails } from "@/components/sessions/ScanFlyerDialog";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { KretoTip } from "@/components/agent/KretoTip";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";

const EVENTS_TUTORIAL: TutorialStep[] = [
  { icon: Search, title: "Find what's happening", body: "Browse This Week, Free, Paid, or Trending — or search by title, venue, or topic." },
  { icon: Globe, title: "See what's near you", body: "Events in your own country surface first, so you're not scrolling past things you can't actually attend." },
  { icon: Plus, title: "Host your own", body: "Publish a workshop, meetup, jam, or screening in a couple of minutes — free or ticketed." },
];

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  category: string;
  cover_image_url: string | null;
  is_ticketed: boolean | null;
  ticket_price: number | null;
  ticket_currency: string | null;
  max_participants: number | null;
  country: string | null;
  created_by: string;
  tags: string[] | null;
}

// Kept deliberately short — these are quick filters, not a taxonomy. Any
// event whose category falls outside this set still shows up under "all";
// it just doesn't get its own chip.
const CATEGORIES = ["all", "music", "workshop", "networking"] as const;
type Cat = typeof CATEGORIES[number];

const Meetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<EventRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState<Cat>("all");
  const [tab, setTab] = useState<"discover" | "this-week" | "free" | "paid" | "trending">("discover");
  const [myCountry, setMyCountry] = useState<string | null>(null);
  const [hostingCount, setHostingCount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [prefill, setPrefill] = useState<ScannedEventDetails | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("location")
          .eq("user_id", user.id)
          .maybeSingle();
        const loc = prof?.location || "";
        const parts = loc.split(",").map((s: string) => s.trim()).filter(Boolean);
        setMyCountry(parts.length > 1 ? parts[parts.length - 1] : null);

        const { count } = await supabase
          .from("creative_jams")
          .select("id", { count: "exact", head: true })
          .eq("created_by", user.id)
          .gte("start_time", new Date().toISOString());
        setHostingCount(count || 0);
      }

      const { data } = await supabase
        .from("creative_jams")
        .select("id, title, description, start_time, end_time, venue_name, venue_address, category, cover_image_url, is_ticketed, ticket_price, ticket_currency, max_participants, country, created_by, tags")
        .eq("is_public", true)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(100);

      setEvents((data as EventRow[]) || []);
    } catch (err) {
      console.error("[Meetup] load failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Real server-side search — the events list above is capped at 100
  // soonest-starting rows, so a client-side filter over it can never find
  // an event outside that window no matter how exact the query. This issues
  // a fresh, uncapped query against creative_jams itself whenever the term
  // is meaningful (2+ chars), debounced, with a monotonic request id so a
  // slower, older response can't overwrite a newer one that lands first.
  const searchRequestId = useRef(0);
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const thisRequest = ++searchRequestId.current;
    const t = window.setTimeout(async () => {
      try {
        const likeQ = escapePostgrestValue(`%${q}%`);
        let query = supabase
          .from("creative_jams")
          .select("id, title, description, start_time, end_time, venue_name, venue_address, category, cover_image_url, is_ticketed, ticket_price, ticket_currency, max_participants, country, created_by, tags")
          .eq("is_public", true)
          .gte("start_time", new Date().toISOString())
          .or(`title.ilike.${likeQ},description.ilike.${likeQ},venue_name.ilike.${likeQ}`)
          .order("start_time", { ascending: true })
          .limit(60);
        if (category !== "all") query = query.eq("category", category);
        const { data, error } = await query;
        if (thisRequest !== searchRequestId.current) return; // a newer search superseded this one
        if (error) throw error;
        setSearchResults((data as EventRow[]) || []);
      } catch (err) {
        console.error("[Meetup] search failed", err);
        if (thisRequest === searchRequestId.current) setSearchResults([]);
      } finally {
        if (thisRequest === searchRequestId.current) setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [search, category]);

  const filtered = useMemo(() => {
    let list = events;
    if (category !== "all") {
      list = list.filter(e => e.category?.toLowerCase() === category);
    }
    if (tab === "this-week") {
      const weekFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
      list = list.filter(e => new Date(e.start_time).getTime() <= weekFromNow);
    } else if (tab === "free") {
      list = list.filter(e => !e.is_ticketed || !e.ticket_price);
    } else if (tab === "paid") {
      list = list.filter(e => e.is_ticketed && e.ticket_price && e.ticket_price > 0);
    } else if (tab === "trending") {
      list = [...list].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    return list;
  }, [events, category, tab]);

  const railThisWeek = useMemo(() => {
    const weekFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return events.filter(e => new Date(e.start_time).getTime() <= weekFromNow).slice(0, 8);
  }, [events]);

  const railFree = useMemo(
    () => events.filter(e => !e.is_ticketed || !e.ticket_price).slice(0, 8),
    [events]
  );

  const railNearYou = useMemo(() => {
    if (!myCountry) return [];
    return events.filter(e => e.country?.toLowerCase() === myCountry.toLowerCase()).slice(0, 8);
  }, [events, myCountry]);

  return (
    <div className="min-h-screen bg-background accent-scout">
      <Helmet>
        <title>Events — Meetups, Workshops & Creative Gatherings | Kretopia</title>
        <meta name="description" content="Discover creative events, meetups, workshops and gatherings near you. Host your own event and reach thousands of creators." />
        <link rel="canonical" href="https://kretopia.com/meetup" />
      </Helmet>

      <FeaturePageHeader
        eyebrow="Live events"
        title="Events."
        accentTitle="Meet in real life."
        subtitle="Workshops, meetups, jams, screenings, premieres — real-world moments built for the creative industry."
        tutorial={{ featureKey: "events", label: "How Events works", steps: EVENTS_TUTORIAL }}

        tabs={
          <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
            {/* Same AI-glow treatment as the Kretopia landing hero search:
                an ambient breathing halo behind the pill plus a scan-line
                sweep along the top edge — purely decorative, never
                intercepts clicks. */}
            <form onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }} className="relative">
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -inset-3 sm:-inset-4 rounded-[28px] blur-xl transition-opacity duration-500 ai-ambient-breathe",
                  searchFocused ? "opacity-100" : "opacity-60",
                )}
                style={{ background: "radial-gradient(60% 100% at 50% 50%, hsl(var(--energy) / 0.2), transparent 70%)" }}
              />
              <div aria-hidden className="pointer-events-none absolute inset-x-3 top-0 h-px overflow-hidden rounded-full">
                <div
                  className="ai-scan-line h-full w-1/3"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(var(--energy)), transparent)" }}
                />
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search events, venues, topics…"
                  aria-label="Search events, venues, topics"
                  className="w-full h-12 sm:h-14 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm pl-12 pr-20 text-sm text-foreground shadow-lg placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-all"
                  style={{ boxShadow: searchFocused ? "var(--shadow-glow)" : undefined }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-14 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors before:absolute before:-inset-2.5 before:content-['']"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  aria-label="Search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md flex items-center justify-center transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            <div className="flex gap-2 justify-center overflow-x-auto scrollbar-hide -mx-1 px-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "shrink-0 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] border transition-all",
                    category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card/40 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <StudioFeatureShell>
        {searchResults !== null ? (
          // A search takes over the whole content area regardless of which
          // tab was selected -- previously the search box lived in the
          // header (visible on every tab) but `filtered` was only read by
          // 4 of the 5 tabs, so typing a query while on the default
          // "Discover" tab (rails, not `filtered`) produced no visible
          // result at all. Search is now its own mode, not tab-scoped.
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {searching ? "Searching…" : `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} for "${search.trim()}"`}
            </p>
            {searching ? (
              <SkeletonGrid />
            ) : searchResults.length === 0 ? (
              <Card className="p-8 text-center border-dashed bg-card/40">
                <Search className="h-10 w-10 mx-auto text-energy/40 mb-3" />
                <h3 className="font-black text-lg mb-1 tracking-tight">No events match "{search.trim()}"</h3>
                <p className="text-sm text-muted-foreground">Try a different title, venue, or topic — or clear the search to browse everything.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((e) => <EventCard key={e.id} ev={e} />)}
              </div>
            )}
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 h-auto gap-2 mb-6">
              {[
                { v: "discover", l: "Discover" },
                { v: "this-week", l: "This Week" },
                { v: "free", l: "Free" },
                { v: "paid", l: "Paid" },
              ].map(({ v, l }) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 text-xs font-bold uppercase tracking-wider"
                >
                  {l}
                </TabsTrigger>
              ))}
              <TabsTrigger
                value="trending"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 text-xs font-bold uppercase tracking-wider"
              >
                <TrendingUp className="h-3.5 w-3.5 mr-1" /> Trending
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discover" className="mt-0 space-y-8">
              {loading ? (
                <SkeletonGrid />
              ) : (
                <>
                  {railThisWeek.length > 0 && <Rail title="This Week" icon={<Calendar className="h-4 w-4 text-energy" />} events={railThisWeek} />}
                  {railNearYou.length > 0 && <Rail title={`In ${myCountry}`} icon={<Globe className="h-4 w-4 text-energy" />} events={railNearYou} />}
                  {railFree.length > 0 && <Rail title="Free Events" icon={<Sparkles className="h-4 w-4 text-energy" />} events={railFree} />}
                  {events.length === 0 && <EmptyState onHost={() => setShowCreate(true)} />}
                </>
              )}
            </TabsContent>

            {(["this-week", "free", "paid", "trending"] as const).map((t) => (
              <TabsContent key={t} value={t} className="mt-0">
                {loading ? (
                  <SkeletonGrid />
                ) : filtered.length === 0 ? (
                  <EmptyState onHost={() => setShowCreate(true)} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((e) => <EventCard key={e.id} ev={e} />)}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <div className="pt-2">
          <AIHostEventCard
            hostingCount={hostingCount}
            onManage={() => navigate("/meetup/manage")}
            onPrefilled={(details) => {
              setPrefill(details);
              setShowCreate(true);
            }}
          />
        </div>
        <KretoTip compact />
      </StudioFeatureShell>

      <CreateSessionDialog open={showCreate} onOpenChange={setShowCreate} onCreated={load} initialDetails={prefill} />
    </div>
  );
};

const Rail = ({ title, icon, events }: { title: string; icon: React.ReactNode; events: EventRow[] }) => (
  <section>
    <div className="flex items-center justify-between mb-3">
      <h2 className="brand-eyebrow flex items-center gap-2">
        {icon} {title}
      </h2>
      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{events.length}</span>
    </div>
    <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
      {events.map((e) => (
        <div key={e.id} className="snap-start shrink-0 w-[260px]">
          <EventCard ev={e} />
        </div>
      ))}
    </div>
  </section>
);

const EventCard = ({ ev }: { ev: EventRow }) => {
  const date = new Date(ev.start_time);
  const isPaid = !!(ev.is_ticketed && ev.ticket_price && ev.ticket_price > 0);
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  return (
    <Link to={`/event/${ev.id}`}>
      <Card className="overflow-hidden group hover:border-energy/50 transition-all hover:-translate-y-0.5 hover:shadow-glow-lime h-full flex flex-col bg-card/60">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/20 to-accent/10 overflow-hidden">
          {ev.cover_image_url && !coverImageFailed ? (
            <img
              src={ev.cover_image_url}
              alt={ev.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setCoverImageFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className="h-12 w-12 text-primary/40" />
            </div>
          )}
          <div className="absolute top-2 left-2 bg-background/90 backdrop-blur rounded-lg px-2 py-1 shadow">
            <div className="text-[9px] font-black text-energy uppercase leading-none tracking-wider">{format(date, "MMM")}</div>
            <div className="text-base font-black leading-none">{format(date, "dd")}</div>
          </div>
          {isPaid ? (
            <Badge className="absolute top-2 right-2 bg-energy text-energy-foreground font-bold uppercase tracking-wider text-[10px]">
              <Ticket className="h-3 w-3 mr-1" />
              {ev.ticket_currency || "USD"} {ev.ticket_price}
            </Badge>
          ) : (
            <Badge className="absolute top-2 right-2 bg-success/90 text-success-foreground font-bold uppercase tracking-wider text-[10px]">Free</Badge>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col">
          <h3 className="font-bold text-sm line-clamp-2 leading-tight mb-1.5 tracking-tight">{ev.title}</h3>
          <div className="text-[11px] text-muted-foreground space-y-0.5 mt-auto">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>{format(date, "EEE, MMM d · h:mm a")}</span>
            </div>
            {ev.venue_name && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{ev.venue_name}</span>
              </div>
            )}
            {ev.max_participants && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 shrink-0" />
                <span>Up to {ev.max_participants}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
};

const SkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="aspect-[4/5] rounded-lg bg-muted/50 animate-pulse" />
    ))}
  </div>
);

const EmptyState = (_: { onHost?: () => void }) => (
  <Card className="p-8 text-center border-dashed bg-card/40">
    <Calendar className="h-12 w-12 mx-auto text-energy/40 mb-3" />
    <h3 className="font-black text-lg mb-1 tracking-tight">No events yet</h3>
    <p className="text-sm text-muted-foreground mb-4">Be the first to host one in your city.</p>
    <p className="text-xs text-muted-foreground/80">Use the <span className="font-semibold text-foreground">Host Event</span> button above to publish the first one.</p>
  </Card>
);

export default Meetup;
