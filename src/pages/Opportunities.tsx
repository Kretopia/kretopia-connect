import { useAccountTone } from "@/hooks/useAccountTone";
import ManageOpportunities from "@/pages/ManageOpportunities";
import { Link, useSearchParams } from "react-router-dom";
import { RedirectKeepingSearch } from "@/components/RedirectKeepingSearch";
import { useState } from "react";
import { SEO } from "@/components/SEO";
import { OpportunitiesFeed } from "@/components/circle/OpportunitiesFeed";
import { ScoutedGigsSection } from "@/components/opportunity/ScoutedGigsSection";
import { EditorialPageHero } from "@/components/kretopia/EditorialPageHero";
import { GigsViewToggle, type GigsView } from "@/components/opportunity/GigsViewToggle";
import { Button } from "@/components/ui/button";
import { Radar } from "lucide-react";
import { SCOUT_PATH, scoutFeedTarget } from "@/lib/opportunityRoutes";

type Tab = GigsView;

const Opportunities = () => {
  const [params] = useSearchParams();
  const marketplace = params.get("view") === "marketplace";
  const [tab, setTab] = useState<Tab>(marketplace ? "marketplace" : "scouted");

  const { isBusiness } = useAccountTone();
  if (isBusiness && !marketplace) return <ManageOpportunities company />;
  return <RedirectKeepingSearch to={scoutFeedTarget(params.toString())} />;
  /* Retired presentation; the feed now lives in Scout.
  return (
    <div className="min-h-screen pb-20 bg-background">
      <SEO
        title="Gigs — Find Creative Work | Kretopia"
        description="Browse and apply for creative gigs — paid jobs, collaborations, and barter opportunities across film, music, fashion, events and more."
      />

      <EditorialPageHero
        kicker="Live gigs"
        title="Gigs."
        accentTitle="Find your next one."
        subtitle="Real gigs scouted from across the web, plus the Kretopia marketplace — one feed."
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <GigsViewToggle value={tab} onChange={setTab} />
          {/* Scout is the personalised search and shortlist of this space: same page as before, reached from here instead of from a nav entry of its own. */}
          <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full text-xs font-semibold">
            <Link to={SCOUT_PATH}><Radar className="h-3.5 w-3.5" aria-hidden /> Scout: search and shortlist</Link>
          </Button>
        </div>
      </EditorialPageHero>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {tab === "scouted" ? <ScoutedGigsSection /> : <OpportunitiesFeed />}
      </div>
    </div>
  ); */
};

export default Opportunities;
