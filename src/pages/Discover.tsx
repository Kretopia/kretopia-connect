import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageHeader } from "@/components/ui/page-header";
import { Compass, Users, Briefcase, Radio, Calendar, Map, LayoutGrid, Sparkles, Search, Radar, Store, Plus, Handshake, UserSearch } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PostOpportunityDialog } from "@/components/PostOpportunityDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

import { SwipeFeature } from "@/components/swipe";
import { ScoutedGigsSection } from "@/components/opportunity/ScoutedGigsSection";
import { OpportunitiesFeed } from "@/components/circle/OpportunitiesFeed";
import { LiveCallsPanel } from "@/components/circle/LiveCallsPanel";
import { SessionsSection } from "@/components/sessions/SessionsSection";
import { NearbyInline } from "@/components/discover/NearbyInline";
import { KretoTip } from "@/components/agent/KretoTip";
import { supabase } from "@/integrations/supabase/client";

type Tab = "people" | "opps" | "live" | "events";
const VALID: Tab[] = ["people", "opps", "live", "events"];

type PeopleMode = "swipe" | "browse" | "nearby";
type OppsMode = "scouted" | "open" | "leads";

/**
 * Discover — the hub for everything outside your own Desk.
 * 4 lanes: People · Gigs · Live · Events. Each lane has sub-modes.
 */
export default function Discover() {
  const navigate = useNavigate();
  const navTalent = () => navigate("/talent-finder");
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = useMemo(
    () => (VALID.includes(requested as Tab) ? (requested as Tab) : "people"),
    [requested]
  );

  const [peopleMode, setPeopleMode] = useState<PeopleMode>("swipe");
  const [oppsMode, setOppsMode] = useState<OppsMode>("scouted");
  const [postOpen, setPostOpen] = useState(false);

  // Live-now pulse on the Live tab
  const [liveCount, setLiveCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { count } = await supabase
        .from("sound_stages")
        .select("id", { count: "exact", head: true })
        .eq("is_live", true);
      if (!cancelled) setLiveCount(count ?? 0);
    };
    check().catch(() => {});
    const ch = supabase
      .channel("discover-live-pulse")
      .on("postgres_changes", { event: "*", schema: "public", table: "sound_stages" }, () => {
        check().catch(() => {});
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, []);

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <SEO
        title="Discover — People, Gigs, Live & Events | Kretopia"
        description="Meet collaborators, find scouted gigs, drop into live stages, catch what's on — all in one feed."
      />
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <PageHeader
          eyebrow="The Hub"
          title="Discover"
          subtitle="People · Gigs · Live · Events."
          icon={Compass}
          size="sm"
        />

        {/* Soft live-now pulse — always visible at top when on-air */}
        {liveCount > 0 && tab !== "live" && (
          <button
            onClick={() => setTab("live")}
            className="mt-3 w-full flex items-center gap-2.5 rounded-xl border border-[hsl(var(--energy))]/30 bg-[hsl(var(--energy))]/5 px-3 py-2.5 text-left hover:border-[hsl(var(--energy))]/60 transition-colors"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--energy))] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--energy))]" />
            </span>
            <Radio className="h-3.5 w-3.5 text-[hsl(var(--energy))]" />
            <span className="text-xs font-semibold flex-1">
              {liveCount} stage{liveCount === 1 ? "" : "s"} on air now
            </span>
            <span className="text-[11px] text-muted-foreground">Tap to join →</span>
          </button>
        )}

        <div className="mt-3">
          <KretoTip surface="discover" compact />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
        <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border/60 px-2 py-2 mt-3">
          <TabsList className="w-full grid grid-cols-4 h-10">
            <TabsTrigger value="people" className="gap-1 text-[11px]">
              <Users className="h-3.5 w-3.5" /> People
            </TabsTrigger>
            <TabsTrigger value="opps" className="gap-1 text-[11px]">
              <Briefcase className="h-3.5 w-3.5" /> Gigs
            </TabsTrigger>
            <TabsTrigger value="live" className="gap-1 text-[11px]">
              <Radio className="h-3.5 w-3.5" /> Live
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1 text-[11px]">
              <Calendar className="h-3.5 w-3.5" /> Events
            </TabsTrigger>
          </TabsList>
        </div>

        {/* PEOPLE */}
        <TabsContent value="people" className="mt-0 px-3 py-3 accent-match space-y-3">
          <div className="inline-flex rounded-full border border-border bg-card p-0.5 w-full sm:w-auto">
            {([
              { id: "swipe", label: "Swipe", icon: Sparkles },
              { id: "browse", label: "Browse", icon: LayoutGrid },
              { id: "nearby", label: "Nearby", icon: Map },
              { id: "talent", label: "Talent", icon: UserSearch },
            ] as const).map((m) => {
              const Icon = m.icon;
              const active = peopleMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.id === "talent") {
                      navTalent();
                      return;
                    }
                    setPeopleMode(m.id as PeopleMode);
                  }}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-full transition-colors inline-flex items-center justify-center gap-1 ${
                    active ? "bg-[hsl(var(--energy))] text-white" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" /> {m.label}
                </button>
              );
            })}
          </div>

          {peopleMode === "swipe" && <SwipeFeature />}
          {peopleMode === "browse" && <BrowseCreatorsLazy />}
          {peopleMode === "nearby" && <NearbyInline />}
        </TabsContent>

        {/* OPPORTUNITIES */}
        <TabsContent value="opps" className="mt-0 px-3 py-3 accent-scout space-y-4">
          {/* Sub-mode toggle — mirrors People */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-card p-0.5 flex-1">
              {([
                { id: "scouted", label: "Scouted", icon: Radar },
                { id: "open", label: "Open", icon: Store },
                { id: "leads", label: "Leads", icon: Handshake },
              ] as const).map((m) => {
                const Icon = m.icon;
                const active = oppsMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setOppsMode(m.id)}
                    className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors inline-flex items-center justify-center gap-1 ${
                      active ? "bg-[hsl(var(--signal-amber))] text-black" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" /> {m.label}
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              onClick={() => setPostOpen(true)}
              className="h-9 px-3 rounded-full bg-foreground text-background hover:bg-foreground/90"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Post
            </Button>
          </div>

          {/* Helper strip — explains what lives where */}
          <p className="text-[11px] text-muted-foreground px-1">
            {oppsMode === "scouted" && "Real gigs Kreto found for you across the web."}
            {oppsMode === "open" && "Collabs, barters and freelance gigs posted by the community."}
            {oppsMode === "leads" && "Brands, sponsors and clients that fit your work."}
          </p>

          {oppsMode === "scouted" && <ScoutedGigsSection />}
          {oppsMode === "open" && <OpportunitiesFeed />}
          {oppsMode === "leads" && (
            <div className="space-y-3">
              <Card className="rounded-xl border-[hsl(var(--signal-amber))]/30 bg-[hsl(var(--signal-amber))]/5 shadow-none">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-[hsl(var(--signal-amber))]" />
                    <p className="font-semibold text-sm">Sponsor & client leads</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Brands and clients that fit your work — surfaced by Kreto. No Studio required.
                  </p>
                  <Link to="/intel" className="inline-block text-xs font-semibold text-[hsl(var(--signal-amber))] hover:underline">
                    Open Opportunity Intel →
                  </Link>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-border/60 shadow-none">
                <CardContent className="p-4 space-y-2">
                  <p className="font-semibold text-sm">Ask Kreto to find leads</p>
                  <p className="text-xs text-muted-foreground">
                    Tell Kreto who you want to work with — sponsors, brands, agencies — and she scouts in the background.
                  </p>
                  <Link to="/intel?focus=sponsors" className="inline-block text-xs font-semibold text-primary hover:underline">
                    Set sponsor radar →
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          <PostOpportunityDialog open={postOpen} onOpenChange={setPostOpen} />
        </TabsContent>

        {/* LIVE */}
        <TabsContent value="live" className="mt-0 px-3 py-3 space-y-3">
          <LiveCallsPanel />
        </TabsContent>

        {/* EVENTS */}
        <TabsContent value="events" className="mt-0 px-3 py-3">
          <SessionsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Lazy-load Browse to avoid hitting profiles table when user starts on Swipe
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
const BrowseCreators = lazy(() =>
  import("@/components/discover/BrowseCreators").then((m) => ({ default: m.BrowseCreators }))
);
const BrowseCreatorsLazy = () => (
  <Suspense
    fallback={
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-10 justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading creators…
      </div>
    }
  >
    <BrowseCreators />
  </Suspense>
);
