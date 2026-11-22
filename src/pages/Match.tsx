import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { LayoutGrid, UserCheck, IdCard, Heart, Send } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { MatchDeck } from "@/components/swipe";
import { MatchPulse } from "@/components/swipe/MatchPulse";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { MATCH_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { FeatureSectionNav } from "@/components/features/FeatureSectionNav";
import {
  BROWSE_VIEW_IDS,
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
      .then(({ toast }) => toast("Your discovery deck is ready", { description: "Explore profiles and express your interest.", duration: 5000 }))
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
          {browseView === BROWSE_VIEW_IDS.deck ? (
            <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]"><MatchPulse /><MatchDeck cardVariant="shell" /></div>
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
              <LikesYouGrid key={connectedView} direction={connectedView === CONNECTED_VIEW_IDS.sent ? "sent" : "received"} />
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
        subtitle="Creative connections without borders. Find familiar ground — or a whole new perspective."
        tutorial={{ featureKey: "match", label: "How Match works", steps: MATCH_TUTORIAL }}
      />

      <StudioFeatureShell wrapped={{ name: "Match" }}>
        <FeatureSectionNav
          items={[
            { id: "browse:deck", label: "Browse", icon: LayoutGrid },
            { id: "browse:grid", label: "Grid", icon: LayoutGrid },
            { id: "directory:", label: "Directory", icon: IdCard },
            { id: "connected:connected", label: "Connected", icon: UserCheck },
            { id: "connected:interested", label: "Interested", icon: Heart },
            { id: "connected:sent", label: "Sent interests", icon: Send },
          ]}
          value={`${activeTab}:${activeView}`}
          label="Match sections"
          onChange={(id) => {
            const [tab, view = ""] = id.split(":");
            goTo(tab as MatchTabId, view);
          }}
        />
        <div role="tabpanel" aria-label={matchTabs.find((t) => t.id === activeTab)?.label} className="mt-4 min-w-0">
          {matchTabs.find((t) => t.id === activeTab)?.content}
        </div>
      </StudioFeatureShell>
    </div>
  );
}
