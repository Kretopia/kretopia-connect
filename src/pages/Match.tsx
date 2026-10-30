import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Sparkles, LayoutGrid, UserCheck, Users } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { MatchDeck } from "@/components/swipe";
import { MatchPulse } from "@/components/swipe/MatchPulse";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { MATCH_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { FeatureSectionNav } from "@/components/features/FeatureSectionNav";
import type { StudioSectionTab } from "@/components/studio-reference/StudioSectionTabs";

const TAB_IDS = ["discover", "browse", "interested", "connected"] as const;
type MatchTabId = (typeof TAB_IDS)[number];

const LikesYouGrid = lazy(() =>
  import("@/components/swipe/LikesYouGrid").then((m) => ({ default: m.LikesYouGrid }))
);

const ConnectedCollaborators = lazy(() =>
  import("@/components/circle/ConnectedCollaborators").then((m) => ({ default: m.ConnectedCollaborators }))
);

const BrowseCreators = lazy(() =>
  import("@/components/discover/BrowseCreators").then((m) => ({ default: m.BrowseCreators }))
);

const loadingRow = (label: string) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground py-10 justify-center">
    <KretopiaSpinner className="h-3.5 w-3.5" /> {label}
  </div>
);

/**
 * Match — one-card-at-a-time deck (Discover) + a grid (Browse) + the people
 * who showed interest (Interested) + accepted connections (Connected) -- not
 * dating-app labels. Connected is the old /circle Network tab, which is where
 * /circle?tab=network now lands. The deck itself
 * (SwipeFeature -> HingeStyleCard, real server-authoritative swipe/match via
 * useSwipeActions) and the HoloCard visual treatment are a separate, more
 * involved pass: HingeStyleCard almost certainly owns its own pointer-based
 * drag gesture for the swipe motion, and HoloCard also tracks pointer events
 * for its tilt effect on the same element -- wrapping one in the other needs
 * that gesture code read first to confirm they don't fight over the same
 * pointer events, not a blind wrap. See STUDIO_REFERENCE_SURFACE_AUDIT.md.
 */
export default function Match() {
  // StudioSectionTabs' uncontrolled mode only reads ?tab= once, at mount
  // (Radix's defaultValue semantics) -- a same-page navigate("/match?tab=
  // browse"), like the deck's empty-state "Browse the grid" CTA, updated
  // the URL but never the visible tab. Controlled mode (activeId) plus
  // this effect keep the two in sync in both directions: a manual tab
  // click still writes the URL (via StudioSectionTabs' own queryParam
  // handling), and an external URL change now updates the visible tab too.
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<MatchTabId>(() => {
    const fromQuery = searchParams.get("tab");
    return (TAB_IDS as readonly string[]).includes(fromQuery || "") ? (fromQuery as MatchTabId) : "discover";
  });

  useEffect(() => {
    const fromQuery = searchParams.get("tab");
    if (fromQuery && (TAB_IDS as readonly string[]).includes(fromQuery) && fromQuery !== activeTab) {
      setActiveTab(fromQuery as MatchTabId);
    }
  }, [searchParams, activeTab]);

  // The handoff from onboarding (/circle?welcome=match used to open the deck with this toast).
  useEffect(() => {
    if (searchParams.get("welcome") !== "match") return;
    import("sonner")
      .then(({ toast }) => toast.success("We found you a match!", { description: "Tap the first card to say hi.", duration: 5000 }))
      .catch(() => {});
    const next = new URLSearchParams(searchParams);
    next.delete("welcome");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const matchTabs: StudioSectionTab[] = [
    {
      id: "discover",
      label: "Discover",
      icon: Sparkles,
      content: (
        <div className="w-full min-w-0">
          <div className="w-full min-w-0">
            <MatchDeck />
          </div>
        </div>
      ),
    },
    {
      id: "browse",
      label: "Browse",
      icon: LayoutGrid,
      content: (
        <Suspense fallback={loadingRow("Loading creators…")}>
          <BrowseCreators />
        </Suspense>
      ),
    },
    {
      // LikesYouGrid queries the swipes table for people who swiped right on
      // you and you haven't responded to yet -- that's genuinely different
      // from an accepted-connections list (the `connections` table, shown in
      // the Connected tab below). Labeled for what this tab actually shows
      // rather than the old dating-app "Likes you".
      id: "interested",
      label: "Interested",
      icon: Users,
      content: (
        <Suspense fallback={loadingRow("Loading…")}>
          <LikesYouGrid />
        </Suspense>
      ),
    },
    {
      id: "connected",
      label: "Connected",
      icon: UserCheck,
      content: (
        <Suspense fallback={loadingRow("Loading…")}>
          <ConnectedCollaborators />
        </Suspense>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background accent-match">
      <SEO
        title="Match — Find your collaborators | Kretopia"
        description="Swipe or browse creators whose work proves they can do the brief."
      />
      <FeaturePageHeader
        scene="match"
        eyebrow="Collaborators"
        title="Match."
        accentTitle="Find your people."
        subtitle="Discover the deck or browse the grid — connect by skill, city, and the people you've already made things with."
        tutorial={{ featureKey: "match", label: "How Match works", steps: MATCH_TUTORIAL }}
      />

      <StudioFeatureShell wrapped={{ name: "Match" }}>
        <MatchPulse />
        <FeatureSectionNav items={matchTabs.map(t => ({ id: t.id, label: t.label, icon: t.icon || Sparkles }))} value={activeTab} label="Match sections" onChange={(id) => {
          setActiveTab(id as MatchTabId);
          const next = new URLSearchParams(searchParams); next.set("tab", id); setSearchParams(next, { replace: true });
        }} />
        <div role="tabpanel" aria-label={matchTabs.find(t => t.id === activeTab)?.label} className="mt-4 min-w-0">{matchTabs.find(t => t.id === activeTab)?.content}</div>
      </StudioFeatureShell>
    </div>
  );
}
