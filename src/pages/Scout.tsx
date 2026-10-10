import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { summarizeScoutedGigs, type ScoutedGigSummary } from "@/lib/scoutGigSummary";
import { SEO } from "@/components/SEO";
import { OpportunitiesFeed } from "@/components/circle/OpportunitiesFeed";
import { ScoutedGigsSection } from "@/components/opportunity/ScoutedGigsSection";
import { ShortlistedGigs } from "@/components/opportunity/ShortlistedGigs";
import { Radar, Store, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { ScoutKretoAssist } from "@/components/scout/ScoutKretoAssist";
import { ScoutScanProvider } from "@/components/scout/ScoutScanProvider";
import { ScoutWrapped } from "@/components/scout/ScoutWrapped";
import { ScoutResultsWrapped } from "@/components/scout/ScoutResultsWrapped";
import type { ScoutTab } from "@/components/scout/scout.types";
import { SCOUT_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { Button } from "@/components/ui/button";

type Tab = ScoutTab;

// Tab order: For You first (the personalized scout is the reason to open
// this page), then the open marketplace, then saved gigs.
const TABS: { id: Tab; label: string; icon: typeof Radar; hint: string }[] = [
  { id: "scouted", label: "For You", icon: Radar, hint: "Real gigs scouted from across the web" },
  { id: "marketplace", label: "Open Gigs", icon: Store, hint: "All open gigs on Kretopia" },
  { id: "shortlist", label: "Shortlist", icon: Bookmark, hint: "Gigs you saved for later" },
];

/**
 * Scout — gigs. People-discovery lives on Today (Discover Creatives) and in /circle.
 */
const Scout = () => {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab");
  const initial = TABS.some((t) => t.id === requestedTab) ? (requestedTab as Tab) : "scouted";
  const contextQuery = params.get("q") || "";
  const [tab, setTab] = useState<Tab>(initial);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const switchTab = (next: Tab) => {
    setTab(next);
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  // Kreto gets the list the user is actually looking at, so its answer is
  // about these gigs rather than gigs in general. Read at click time from the
  // same cache the For You tab renders from.
  const describeScoutedGigs = () => {
    const gigs = queryClient.getQueryData<ScoutedGigSummary[]>(["scouted-gigs", user?.id]) ?? [];
    return summarizeScoutedGigs(gigs);
  };

  // Watches that same cache without fetching (skipToken): Kreto's panel is for
  // "found one worth pursuing", so on For You it waits until there are gigs.
  const { data: scoutedCount = 0 } = useQuery({
    queryKey: ["scouted-gigs", user?.id],
    queryFn: skipToken,
    select: (gigs: unknown[]) => gigs.length,
    enabled: !!user,
  });
  const showKreto = tab !== "scouted" || scoutedCount > 0;

  return (
    <div className="accent-scout min-h-screen bg-background">
      <SEO
        title="Scout — Find your next gig & collaborator | Kretopia"
        description="One feed for the gigs that fit your work — scouted from job boards and matched to your Passport."
      />

      {/* Same header as Studio: eyebrow slot holds the tutorial trigger, a
          white first line, a gradient second line, a subtitle -- and nothing
          else. The section switcher lives in the body, right under it. */}
      <FeaturePageHeader
        eyebrow="Scout"
        title="Find the gigs"
        accentTitle="that fit your work."
        subtitle="Filter the noise and shortlist real fits, or just chat with Kreto. Fresh gigs from job boards, matched to your Passport."
        tutorial={{ featureKey: "scout", label: "How Scout works", steps: SCOUT_TUTORIAL }}
      />

      {/* Body: two Wrapped surfaces. The top one says what is on your list and
          holds Scan now; the bottom one holds everything else (the section
          switcher, the list, Kreto's panel once there is something to act on).
          One scan state is shared by both. */}
      <ScoutScanProvider>
      <StudioFeatureShell>
        <ScoutWrapped onSelectTab={switchTab} />

        <ScoutResultsWrapped>
        <div
          role="tablist"
          aria-label="Scout sections"
          className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card w-fit max-w-full overflow-x-auto"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <Button
                key={t.id}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={active}
                aria-label={t.hint}
                onClick={() => switchTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", active && "text-foreground")} />
                {t.label}
              </Button>
            );
          })}
        </div>

        {contextQuery && (
          <div className="rounded-xl border border-border bg-card p-3 text-xs flex items-start gap-2">
            <Radar className="h-3.5 w-3.5 mt-0.5 text-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">From your Studio:</p>
              <p className="text-muted-foreground truncate">{contextQuery}</p>
            </div>
          </div>
        )}
        {tab === "scouted" && <ScoutedGigsSection scanSurface="wrapped" />}
        {tab === "shortlist" && <ShortlistedGigs />}
        {tab === "marketplace" && <OpportunitiesFeed />}
        {showKreto && <ScoutKretoAssist getPromptContext={describeScoutedGigs} />}
        </ScoutResultsWrapped>
      </StudioFeatureShell>
      </ScoutScanProvider>
    </div>
  );
};

export default Scout;
