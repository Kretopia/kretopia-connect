import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { LayoutGrid, UserCheck, IdCard } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { MatchDeck } from "@/components/swipe";
import { MatchPulse } from "@/components/swipe/MatchPulse";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { MATCH_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { FeatureSectionNav } from "@/components/features/FeatureSectionNav";
import { SegmentToggle } from "@/components/features/SegmentToggle";
import {
  BROWSE_SEGMENT_OPTIONS,
  BROWSE_VIEW_IDS,
  CONNECTED_SEGMENT_OPTIONS,
  CONNECTED_VIEW_IDS,
  matchTabFromParams,
  type BrowseViewId,
  type ConnectedViewId,
  type MatchTabId,
} from "@/lib/matchSections";
import type { StudioSectionTab } from "@/components/studio-reference/StudioSectionTabs";

const LikesYouGrid = lazy(() =>
  import("@/components/swipe/LikesYouGrid").then((m) => ({ default: m.LikesYouGrid }))
);

const ConnectedCollaborators = lazy(() =>
  import("@/components/circle/ConnectedCollaborators").then((m) => ({ default: m.ConnectedCollaborators }))
);

const BrowseCreators = lazy(() =>
  import("@/components/discover/BrowseCreators").then((m) => ({ default: m.BrowseCreators }))
);

const PassportDirectory = lazy(() => import("@/pages/PassportDirectory"));

const loadingRow = (label: string) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground py-10 justify-center">
    <KretopiaSpinner className="h-3.5 w-3.5" /> {label}
  </div>
);

/**
 * Match — Browse (the one-card-at-a-time deck, or the filterable grid: a SegmentToggle picks which, see
 * lib/matchSections.ts) + Directory (every public Passport) + Connected (accepted connections, or who is
 * interested in you, again by SegmentToggle) -- not dating-app labels. Connected is the old /circle Network
 * tab, which is where /circle?tab=network now lands.
 *
 * Discover used to be its own top-level tab (the deck) and Interested its own (people who swiped right on you);
 * both now live as the second segment of Browse and Connected respectively, since each pair is two views of the
 * same kind of thing (find people vs. people already found you) rather than two unrelated destinations. An old
 * link to ?tab=discover or ?tab=interested still lands in the right place (matchTabFromParams).
 *
 * The deck itself (SwipeFeature -> HingeStyleCard, real server-authoritative swipe/match via useSwipeActions) and
 * the HoloCard visual treatment are a separate, more involved pass: HingeStyleCard almost certainly owns its own
 * pointer-based drag gesture for the swipe motion, and HoloCard also tracks pointer events for its tilt effect on
 * the same element -- wrapping one in the other needs that gesture code read first to confirm they don't fight
 * over the same pointer events, not a blind wrap. See STUDIO_REFERENCE_SURFACE_AUDIT.md.
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
  const resolved = () => matchTabFromParams(searchParams.get("tab"), searchParams.get("view"));
  const [{ tab: activeTab, view: activeView }, setActive] = useState<{ tab: MatchTabId; view: string }>(resolved);

  useEffect(() => {
    const next = resolved();
    if (next.tab !== activeTab || next.view !== activeView) setActive(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolved() reads searchParams directly
  }, [searchParams]);

  const goTo = (tab: MatchTabId, view: string) => {
    setActive({ tab, view });
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    // Directory has no second view: keep its URL exactly as before the merge (no "view" key at all).
    if (view) next.set("view", view);
    else next.delete("view");
    setSearchParams(next, { replace: true });
  };

  const browseView = activeTab === "browse" ? (activeView as BrowseViewId) : BROWSE_VIEW_IDS.deck;
  const connectedView = activeTab === "connected" ? (activeView as ConnectedViewId) : CONNECTED_VIEW_IDS.connected;

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
      id: "browse",
      label: "Browse",
      icon: LayoutGrid,
      content: (
        <div className="w-full min-w-0 space-y-4">
          <SegmentToggle
            value={browseView}
            onChange={(v) => goTo("browse", v)}
            options={BROWSE_SEGMENT_OPTIONS}
            label="Browse view"
          />
          {browseView === BROWSE_VIEW_IDS.deck ? (
            <MatchDeck cardVariant="shell" />
          ) : (
            <Suspense fallback={loadingRow("Loading creators…")}>
              <BrowseCreators />
            </Suspense>
          )}
        </div>
      ),
    },
    {
      id: "directory",
      label: "Directory",
      icon: IdCard,
      content: (
        <Suspense fallback={loadingRow("Loading Passports…")}>
          <PassportDirectory embedded />
        </Suspense>
      ),
    },
    {
      id: "connected",
      label: "Connected",
      icon: UserCheck,
      content: (
        <div className="w-full min-w-0 space-y-4">
          <SegmentToggle
            value={connectedView}
            onChange={(v) => goTo("connected", v)}
            options={CONNECTED_SEGMENT_OPTIONS}
            label="Connected view"
          />
          {connectedView === CONNECTED_VIEW_IDS.connected ? (
            <Suspense fallback={loadingRow("Loading…")}>
              <ConnectedCollaborators />
            </Suspense>
          ) : (
            // LikesYouGrid queries the swipes table for people who swiped right on you and you haven't
            // responded to yet -- genuinely different from the accepted-connections list above it (the
            // `connections` table). Labeled for what this view actually shows rather than a dating-app
            // "Likes you".
            <Suspense fallback={loadingRow("Loading…")}>
              <LikesYouGrid />
            </Suspense>
          )}
        </div>
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
        <FeatureSectionNav
          items={matchTabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon || LayoutGrid }))}
          value={activeTab}
          label="Match sections"
          onChange={(id) => {
            const tab = id as MatchTabId;
            const defaultView = tab === "browse" ? BROWSE_VIEW_IDS.deck : tab === "connected" ? CONNECTED_VIEW_IDS.connected : "";
            goTo(tab, defaultView);
          }}
        />
        <div role="tabpanel" aria-label={matchTabs.find((t) => t.id === activeTab)?.label} className="mt-4 min-w-0">
          {matchTabs.find((t) => t.id === activeTab)?.content}
        </div>
      </StudioFeatureShell>
    </div>
  );
}
