import { useState, useEffect, useCallback } from "react";
import { MatchCelebrationDialog } from "@/components/discover/MatchCelebrationDialog";
import { PageTip } from "@/components/PageTip";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConnectionList } from "@/components/circle/ConnectionList";
import { SwipeFeature } from "@/components/swipe";
import { GuestSwipePreview } from "@/components/swipe/GuestSwipePreview";
import { NetworkVisualization } from "@/components/circle/NetworkVisualization";
import { LiveCallsPanel } from "@/components/circle/LiveCallsPanel";
import { SEO } from "@/components/SEO";
import { ProfileActivationGate } from "@/components/ProfileActivationGate";
import { InviteDialog } from "@/components/InviteDialog";
import { InviteCircleCard } from "@/components/InviteCircleCard";
import { SwipeFilters, SwipeFiltersState, DEFAULT_SWIPE_FILTERS } from "@/components/circle/SwipeFilters";
import { Sparkles, Users, LayoutGrid, UserPlus, Radio } from "lucide-react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getDiscoveryMissingFields } from "@/lib/profileCompletion";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { PageTransition } from "@/components/PageTransition";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoTip } from "@/components/agent/KretoTip";
import { SOUNDSTAGES_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { StudioSectionTabs, type StudioSectionTab } from "@/components/studio-reference/StudioSectionTabs";
import { StudioEmptyState } from "@/components/studio-reference/StudioEmptyState";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";

type BrowseProfile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
};

type CircleTabId = "stages" | "match" | "browse" | "network";

export default function Circle() {
  const { user, subscriptionInfo } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  // "live" is the old deep-link value from when Stage content rendered
  // unconditionally below the tabs rather than as a tab of its own — still
  // honored here so existing links keep landing on the right place.
  const initialTab: CircleTabId =
    tabParam === "browse" ? "browse" :
    tabParam === "network" ? "network" :
    tabParam === "match" ? "match" :
    "stages";
  const [activeTab, setActiveTab] = useState<CircleTabId>(initialTab);
  const [profileVisibility, setProfileVisibility] = useState<{ isVisible: boolean; missingFields: string[] }>({ isVisible: true, missingFields: [] });
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [filters, setFilters] = useState<SwipeFiltersState>(DEFAULT_SWIPE_FILTERS);
  const [profilesCount, setProfilesCount] = useState(0);
  const [browseProfiles, setBrowseProfiles] = useState<BrowseProfile[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [matchedUser, setMatchedUser] = useState<{ name: string; avatar: string; role: string; userId: string } | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);

  const isPro = hasProAccess(subscriptionInfo.tier as any);

  // Welcome handoff
  useEffect(() => {
    if (searchParams.get("welcome") === "match") {
      setActiveTab("match");
      import("sonner").then(({ toast }) => {
        toast.success("We found you a match!", {
          description: "Tap the first card to say hi.",
          duration: 5000,
        });
      }).catch(() => {});
      const next = new URLSearchParams(searchParams);
      next.delete("welcome");
      next.set("tab", "match");
      navigate(`/circle?${next.toString()}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("avatar_url, bio")
      .eq("user_id", user.id)
      .single()
      .then(async ({ data: profile }) => {
        if (!profile) return;
        const { count } = await supabase
          .from("credits")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        const missingFields = getDiscoveryMissingFields(profile as any, count || 0);
        setProfileVisibility({ isVisible: missingFields.length === 0, missingFields });
      }, () => {});
  }, [user?.id]);

  const fetchConnections = useCallback(async () => {
    if (!user?.id) return;
    setConnectionsLoading(true);
    try {
      const [outgoing, incoming] = await Promise.all([
        supabase.from("connections").select("connected_user_id, status").eq("user_id", user.id),
        supabase.from("connections").select("user_id, status").eq("connected_user_id", user.id),
      ]);
      const ids = new Set<string>();
      outgoing.data?.forEach(c => { if (c.status === "accepted") ids.add(c.connected_user_id); });
      incoming.data?.forEach(c => { if (c.status === "accepted") ids.add(c.user_id); });
      if (ids.size === 0) { setConnections([]); return; }
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role, location, level, xp, bio, badge")
        .in("user_id", Array.from(ids));
      setConnections(data || []);
    } catch (e) {
      console.error("[Circle] connections", e);
    } finally {
      setConnectionsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === "network") fetchConnections();
  }, [activeTab, fetchConnections]);

  const fetchBrowse = useCallback(async () => {
    if (!user?.id) return;
    setBrowseLoading(true);
    try {
      let q = supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url, role, location")
        .neq("user_id", user.id)
        .not("avatar_url", "is", null)
        .not("full_name", "is", null)
        .limit(60);
      if (filters.roles?.length) q = q.in("role", filters.roles);
      if (filters.locationCountry) q = q.ilike("location", `%${filters.locationCountry}%`);
      const { data } = await q;
      setBrowseProfiles((data || []) as BrowseProfile[]);
    } finally {
      setBrowseLoading(false);
    }
  }, [user?.id, filters.roles, filters.locationCountry]);

  useEffect(() => {
    if (activeTab === "browse") fetchBrowse();
  }, [activeTab, fetchBrowse]);

  const handleMatch = async (m: { name: string; avatar: string; role: string; userId: string }) => {
    const { analytics } = await import("@/lib/analytics");
    analytics.match(m.userId);
    setMatchedUser(m);
    setShowMatchDialog(true);
  };

  const handleMessage = (userId: string) => navigate(`/messages?user=${userId}`);

  const handleFiltersChange = (next: SwipeFiltersState) => {
    if (!isPro) {
      next.verifiedOnly = false;
      next.minFollowers = "all";
      next.experienceLevel = "all";
      next.aiMatchOnly = false;
    }
    setFilters(next);
  };

  const circleTabs: StudioSectionTab[] = [
    {
      id: "stages",
      label: "Stages",
      icon: Radio,
      content: (
        <ProfileActivationGate
          isVisible={profileVisibility.isVisible}
          missingFields={profileVisibility.missingFields}
          surfaceLabel="Stage"
        >
          {user ? (
            <LiveCallsPanel
              joinStageId={searchParams.get("join")}
              onFindCollaborator={() => {
                setActiveTab("match");
                const next = new URLSearchParams(searchParams);
                next.set("tab", "match");
                navigate(`/circle?${next.toString()}`, { replace: true });
              }}
            />
          ) : (
            <AuthGate>
              <div className="h-[40vh] bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl" />
            </AuthGate>
          )}
        </ProfileActivationGate>
      ),
    },
    {
      id: "match",
      label: "Match",
      icon: Sparkles,
      content: (
        <div className="space-y-3">
          <SwipeFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            isPro={isPro}
            profilesCount={profilesCount}
          />
          {user ? (
            <>
              <SwipeFeature
                onMatch={handleMatch}
                filters={filters}
                onProfilesCountChange={setProfilesCount}
              />
              {profilesCount > 0 && (
                <PageTip
                  id="stages-match"
                  title="Welcome to Match"
                  message="Swipe through creators. Tap a card for their profile, then send a connect."
                />
              )}
            </>
          ) : (
            <GuestSwipePreview />
          )}
        </div>
      ),
    },
    {
      id: "browse",
      label: "Browse",
      icon: LayoutGrid,
      content: (
        <div>
          <div className="mb-3">
            <SwipeFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              isPro={isPro}
              profilesCount={browseProfiles.length}
            />
          </div>
          {browseLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : browseProfiles.length === 0 ? (
            <StudioEmptyState
              title="No creators match your filters yet"
              description="Try widening your filters, or check back once more people join."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {browseProfiles.map((p) => (
                <Link
                  key={p.user_id}
                  to={`/profile/${p.user_id}`}
                  className="group rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/40 transition-colors"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={p.full_name ?? "Creator"}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <Avatar className="w-full h-full rounded-none">
                        <AvatarFallback>{(p.full_name ?? "?").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-semibold truncate">{p.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.role ?? "Creator"}
                      {p.location ? ` · ${p.location}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "network",
      label: "Network",
      icon: Users,
      content: (
        <div className="space-y-4">
          {connections.length === 0 && <InviteCircleCard variant="match" />}
          <NetworkVisualization onInvite={() => setShowInvite(true)} />
          {connections.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-sm">Your collaborators</h3>
              <ConnectionList connections={connections} loading={connectionsLoading} onMessage={handleMessage} />
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background accent-match">
        <SEO
          title="Circle — Match, Live & Network"
          description="Find collaborators, jump into live sessions, and grow your creative circle."
        />

        <FeaturePageHeader
          eyebrow="Stages"
          title="Stages."
          accentTitle="Where creators meet, live."
          subtitle="Drop into a live session, match with collaborators, or browse the network."
          tutorial={{ featureKey: "stages", label: "How Stages works", steps: SOUNDSTAGES_TUTORIAL }}
        />

        <StudioFeatureShell>
          <KretoTip compact />

          <StudioSectionTabs
            tabs={circleTabs}
            defaultTabId={initialTab}
            queryParam="tab"
            activeId={activeTab}
            onTabChange={(id) => setActiveTab(id as CircleTabId)}
          />

          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="btn-glass btn-glass-outline w-full text-left rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[hsl(var(--energy))]/15 text-[hsl(var(--energy))] flex items-center justify-center shrink-0">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
                  Kreto-powered
                </p>
                <p className="font-semibold text-sm">Grow your circle</p>
                <p className="text-xs text-muted-foreground">
                  Kreto drafts the invite and picks who's worth reaching out to first.
                </p>
              </div>
            </div>
          </button>
        </StudioFeatureShell>

        <InviteDialog open={showInvite} onOpenChange={setShowInvite} />
        {matchedUser && (
          <MatchCelebrationDialog
            open={showMatchDialog}
            onOpenChange={setShowMatchDialog}
            matchedUser={matchedUser}
            onSendMessage={() => navigate(`/messages?user=${matchedUser.userId}`)}
          />
        )}
      </div>
    </PageTransition>
  );
}
