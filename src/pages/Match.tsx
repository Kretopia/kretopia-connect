import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Sparkles, LayoutGrid, Loader2, Users } from "lucide-react";
import { SwipeFeature } from "@/components/swipe";
import { KretoTip } from "@/components/agent/KretoTip";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { MATCH_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { StudioSectionTabs, type StudioSectionTab } from "@/components/studio-reference/StudioSectionTabs";

const TAB_IDS = ["discover", "browse", "interested"] as const;
type MatchTabId = (typeof TAB_IDS)[number];

const LikesYouGrid = lazy(() =>
  import("@/components/swipe/LikesYouGrid").then((m) => ({ default: m.LikesYouGrid }))
);

const BrowseCreators = lazy(() =>
  import("@/components/discover/BrowseCreators").then((m) => ({ default: m.BrowseCreators }))
);

const loadingRow = (label: string) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground py-10 justify-center">
    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label}
  </div>
);

/**
 * Match — one-card-at-a-time deck (Discover) + a grid (Browse) + real
 * connection state (Connections) -- not dating-app labels. The deck itself
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
  const [searchParams] = useSearchParams();
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

  const matchTabs: StudioSectionTab[] = [
    {
      id: "discover",
      label: "Discover",
      icon: Sparkles,
      content: (
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <SwipeFeature />
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
      // from an accepted-connections list (Circle's Network tab uses the
      // `connections` table for that). Labeled for what this tab actually
      // shows rather than either the old dating-app "Likes you" or a
      // "Connections" name that would misdescribe its real content. A real
      // Connections tab reusing Circle's ConnectionList/connections-table
      // data is a further enhancement, not done in this pass.
      id: "interested",
      label: "Interested",
      icon: Users,
      content: (
        <Suspense fallback={loadingRow("Loading…")}>
          <LikesYouGrid />
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
        eyebrow="Collaborators"
        title="Match."
        accentTitle="Find your people."
        subtitle="Discover the deck or browse the grid — connect by skill, city, and the people you've already made things with."
        tutorial={{ featureKey: "match", label: "How Match works", steps: MATCH_TUTORIAL }}
      />

      <StudioFeatureShell>
        <KretoTip surface="match" compact />
        <StudioSectionTabs
          tabs={matchTabs}
          queryParam="tab"
          activeId={activeTab}
          onTabChange={(id) => setActiveTab(id as MatchTabId)}
        />
      </StudioFeatureShell>
    </div>
  );
}
