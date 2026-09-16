import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { SurfaceProactiveCards } from "@/components/agent/SurfaceProactiveCards";
import { OpportunitiesFeed } from "@/components/circle/OpportunitiesFeed";
import { ScoutedGigsSection } from "@/components/opportunity/ScoutedGigsSection";
import { ShortlistedGigs } from "@/components/opportunity/ShortlistedGigs";
import { Radar, Store, UserSearch, ArrowRight, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { KretoTip } from "@/components/agent/KretoTip";
import { SCOUT_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";

type Tab = "scouted" | "shortlist" | "marketplace";

const TABS: { id: Tab; label: string; icon: typeof Radar; hint: string }[] = [
  { id: "scouted", label: "For You", icon: Radar, hint: "Real gigs scouted from across the web" },
  { id: "shortlist", label: "Shortlist", icon: Bookmark, hint: "Gigs you saved for later" },
  { id: "marketplace", label: "Open Gigs", icon: Store, hint: "All open gigs on Kretopia" },
];

/**
 * Scout — gigs and talent only. Two purposes: find gigs to work on,
 * find creators to hire. People-discovery for collaboration lives in /circle.
 */
const Scout = () => {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab");
  const initial = TABS.some((t) => t.id === requestedTab) ? (requestedTab as Tab) : "scouted";
  const contextQuery = params.get("q") || "";
  const [tab, setTab] = useState<Tab>(initial);

  const switchTab = (next: Tab) => {
    setTab(next);
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };


  return (
    <div className="accent-scout min-h-screen bg-background">
      <SEO
        title="Scout — Find your next gig & collaborator | Kretopia"
        description="One feed for the gigs and people that fit your work — scouted from across the web and curated by Kreto."
      />

      <FeaturePageHeader
        eyebrow="Scout"
        title="Scout."
        accentTitle={<>Gigs &amp; talent, found for you.</>}
        subtitle="One feed for the gigs and people that fit your work — scouted from across the web and curated by Kreto."
        tutorial={{ featureKey: "scout", label: "How Scout works", steps: SCOUT_TUTORIAL }}
        tabs={
          <div className="flex flex-col gap-3">
            <div
              role="tablist"
              aria-label="Scout sections"
              className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card w-fit"
            >
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    aria-label={t.hint}
                    onClick={() => switchTab(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                      active
                        ? "bg-background text-energy shadow-sm ring-1 ring-energy"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", active && "text-energy")} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Secondary navigation — deliberately not styled as tabs: these leave the page */}
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                to="/circle"
                className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Find collaborators in Circle"
              >
                Looking for collaborators? Open Circle
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                to={contextQuery ? `/talent-finder?q=${encodeURIComponent(contextQuery)}` : "/talent-finder"}
                className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open Talent Scout to hire talent"
              >
                <UserSearch className="h-3 w-3" />
                Hiring? Open Talent Scout
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        }
      />

      {/* Body — the scan and its results are the reason someone opens Scout,
          so they render first; the Kreto nudge (a generic, always-available
          "or just chat" prompt, same as every other authed surface) drops to
          the bottom instead of sitting above results on every visit. */}
      <StudioFeatureShell>
        {contextQuery && (
          <div className="rounded-xl border border-[hsl(var(--accent-scout))]/30 bg-[hsl(var(--accent-scout))]/5 p-3 text-xs flex items-start gap-2">
            <Radar className="h-3.5 w-3.5 mt-0.5 text-[hsl(var(--accent-scout))] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">From your Studio:</p>
              <p className="text-muted-foreground truncate">{contextQuery}</p>
            </div>
          </div>
        )}
        {tab === "scouted" && <ScoutedGigsSection />}
        {tab === "shortlist" && <ShortlistedGigs />}
        {tab === "marketplace" && <OpportunitiesFeed />}
        <SurfaceProactiveCards surface="scout" className="px-0" />
        <KretoTip compact />
      </StudioFeatureShell>
    </div>
  );
};

export default Scout;
