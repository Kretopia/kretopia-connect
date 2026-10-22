import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, Calendar, Handshake, LayoutGrid, Map, Plus, Radar, Radio, Search, Sparkles, Store, UserSearch, Users } from "lucide-react";

import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { KretoScene } from "@/components/brand/KretoScene";
import type { KretoSceneId } from "@/components/brand/kretoScenes";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { KretoMark } from "@/components/brand/KretoMark";
import { KretoTip } from "@/components/agent/KretoTip";
import { GlassCtaButton, OutlineCta } from "@/components/ui/glass-cta";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostOpportunityDialog } from "@/components/PostOpportunityDialog";
import { DISCOVER_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { SwipeFeature } from "@/components/swipe";
import { ScoutedGigsSection } from "@/components/opportunity/ScoutedGigsSection";
import { OpportunitiesFeed } from "@/components/circle/OpportunitiesFeed";
import { LiveCallsPanel } from "@/components/circle/LiveCallsPanel";
import { SessionsSection } from "@/components/sessions/SessionsSection";
import { NearbyInline } from "@/components/discover/NearbyInline";
import { DiscoverSwitch, PILL_GROUP, PILL_ITEM } from "@/components/discover/DiscoverSwitch";
import { DiscoverWrapped } from "@/components/discover/DiscoverWrapped";
import { buildDiscoverSignals, useDiscoverSignals, type DiscoverLane } from "@/components/discover/discoverSignals";
import { cn } from "@/lib/utils";

type Tab = DiscoverLane;

const LANES: { id: Tab; label: string; icon: typeof Users; title: ReactNode; scene: KretoSceneId }[] = [
  { id: "people", label: "People", icon: Users, title: <>Creatives <span className="k-gradient-text">to meet</span></>, scene: "match" },
  { id: "opps", label: "Gigs", icon: Briefcase, title: <>Gigs <span className="k-gradient-text">that fit</span></>, scene: "scout" },
  { id: "live", label: "Live", icon: Radio, title: <>Stages <span className="k-gradient-text">on air</span></>, scene: "soundstages" },
  { id: "events", label: "Events", icon: Calendar, title: <>Events <span className="k-gradient-text">to join</span></>, scene: "event" },
];

/** Links that predate the lane ids (Guide, Smart suggestions) still land on the right lane. */
const ALIASES: Record<string, Tab> = { opportunities: "opps" };

type PeopleMode = "swipe" | "browse" | "nearby" | "talent";
type OppsMode = "scouted" | "open" | "leads";

const PEOPLE_MODES = [
  { id: "swipe", label: "Swipe", icon: Sparkles },
  { id: "browse", label: "Browse", icon: LayoutGrid },
  { id: "nearby", label: "Nearby", icon: Map },
  { id: "talent", label: "Talent", icon: UserSearch, leaves: true },
] as const;

const OPPS_MODES = [
  { id: "scouted", label: "Scouted", icon: Radar },
  { id: "open", label: "Open", icon: Store },
  { id: "leads", label: "Leads", icon: Handshake },
] as const;

// Browse reads the profiles table, so it is only fetched once someone opens it.
const BrowseCreators = lazy(() => import("@/components/discover/BrowseCreators").then((m) => ({ default: m.BrowseCreators })));

const BrowseCreatorsLazy = () => (
  <Suspense fallback={<KretopiaLoader label="Loading creators" size="sm" />}>
    <BrowseCreators />
  </Suspense>
);

/** The lane's own card: the same hairline surface as everything inside a Wrapped panel. */
const LeadCard = ({ icon, title, body, to, cta }: { icon: ReactNode; title: string; body: string; to: string; cta: string }) => (
  <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4">
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/50 text-foreground">{icon}</span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
    <p className="text-xs text-muted-foreground">{body}</p>
    <OutlineCta to={to} size="sm" className="mt-auto">
      {cta}
    </OutlineCta>
  </div>
);

/**
 * Discover — the hub for everything outside your own Desk: People, Gigs, Live, Events.
 * Same frame as Scout, Studio, Today and Passport: the shared cinematic header, the Studio body width, and Wrapped
 * panels. The top panel says what is on; the bottom one holds the lane switcher and the lane.
 */
export default function Discover() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") ?? "";
  const tab: Tab = useMemo(() => {
    const wanted = ALIASES[requested] ?? requested;
    return LANES.some((l) => l.id === wanted) ? (wanted as Tab) : "people";
  }, [requested]);
  const lane = LANES.find((l) => l.id === tab) ?? LANES[0];

  const [peopleMode, setPeopleMode] = useState<Exclude<PeopleMode, "talent">>("swipe");
  const [oppsMode, setOppsMode] = useState<OppsMode>("scouted");
  const [postOpen, setPostOpen] = useState(false);

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  const signals = buildDiscoverSignals({ ...useDiscoverSignals(user?.id), onSelect: setTab });

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Discover — People, Gigs, Live & Events | Kretopia"
        description="Meet collaborators, find scouted gigs, drop into live stages, catch what's on — all in one feed."
      />

      <FeaturePageHeader
        eyebrow="Discover"
        title="Discover."
        accentTitle="Meet, scout, join in."
        subtitle="Meet collaborators, find scouted gigs, drop into live Stages and catch what's on, all in one feed."
        tutorial={{ featureKey: "discover", label: "How Discover works", steps: DISCOVER_TUTORIAL }}
      />

      <StudioFeatureShell>
        <DiscoverWrapped signals={signals} />

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
          <WrappedShell
            titleId="discover-lane-title"
            eyebrow="Kretopia · Discover"
            title={lane.title}
            aside={<KretoScene scene={lane.scene} size="thumb" className="hidden h-16 w-32 shrink-0 rounded-xl border border-border sm:block" />}
          >
            <TabsList aria-label="Discover sections" className={cn(PILL_GROUP, "h-auto text-muted-foreground")}>
              {LANES.map((l) => {
                const Icon = l.icon;
                return (
                  <TabsTrigger
                    key={l.id}
                    value={l.id}
                    className={cn(PILL_ITEM, "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border")}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {l.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* PEOPLE */}
            <TabsContent value="people" className="accent-match mt-0 space-y-4">
              <DiscoverSwitch
                label="People modes"
                items={PEOPLE_MODES}
                value={peopleMode}
                onChange={(id: PeopleMode) => (id === "talent" ? navigate("/talent-finder") : setPeopleMode(id))}
              />
              {peopleMode === "swipe" && (
                <div className="mx-auto w-full max-w-2xl">
                  <SwipeFeature />
                </div>
              )}
              {peopleMode === "browse" && <BrowseCreatorsLazy />}
              {peopleMode === "nearby" && <NearbyInline />}
            </TabsContent>

            {/* GIGS */}
            <TabsContent value="opps" className="accent-scout mt-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <DiscoverSwitch label="Gig lists" items={OPPS_MODES} value={oppsMode} onChange={(id: OppsMode) => setOppsMode(id)} />
                <GlassCtaButton size="sm" className="min-h-11 sm:min-h-0" onClick={() => setPostOpen(true)} icon={<Plus className="h-4 w-4" aria-hidden />}>
                  Post
                </GlassCtaButton>
              </div>

              <p className="text-xs text-muted-foreground">
                {oppsMode === "scouted" && "Real gigs Kreto found for you on job boards."}
                {oppsMode === "open" && "Collabs, barters and freelance gigs posted by the community."}
                {oppsMode === "leads" && "Brands, sponsors and clients that fit your work."}
              </p>

              {oppsMode === "scouted" && <ScoutedGigsSection />}
              {oppsMode === "open" && <OpportunitiesFeed />}
              {oppsMode === "leads" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <LeadCard
                    icon={<Search className="h-4 w-4" aria-hidden />}
                    title="Sponsor & client leads"
                    body="Brands and clients that fit your work, surfaced by Kreto. No Studio required."
                    to="/intel"
                    cta="Open Opportunity Intel"
                  />
                  <LeadCard
                    icon={<KretoMark size="xs" />}
                    title="Ask Kreto to find leads"
                    body="Tell Kreto who you want to work with (sponsors, brands, agencies) and she scouts in the background."
                    to="/intel?focus=sponsors"
                    cta="Set sponsor radar"
                  />
                </div>
              )}

              <PostOpportunityDialog open={postOpen} onOpenChange={setPostOpen} />
            </TabsContent>

            {/* LIVE */}
            <TabsContent value="live" className="mt-0 space-y-3">
              <LiveCallsPanel />
            </TabsContent>

            {/* EVENTS */}
            <TabsContent value="events" className="mt-0">
              <SessionsSection />
            </TabsContent>

            <KretoTip surface="discover" compact />
          </WrappedShell>
        </Tabs>
      </StudioFeatureShell>
    </div>
  );
}
