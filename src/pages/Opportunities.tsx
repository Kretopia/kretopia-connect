import { useAccountTone } from "@/hooks/useAccountTone";
import ManageOpportunities from "@/pages/ManageOpportunities";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { SEO } from "@/components/SEO";
import { OpportunitiesFeed } from "@/components/circle/OpportunitiesFeed";
import { ScoutedGigsSection } from "@/components/opportunity/ScoutedGigsSection";
import { EditorialPageHero } from "@/components/kretopia/EditorialPageHero";
import { GigsViewToggle, type GigsView } from "@/components/opportunity/GigsViewToggle";

type Tab = GigsView;

const Opportunities = () => {
  const [params] = useSearchParams();
  const marketplace = params.get("view") === "marketplace";
  const [tab, setTab] = useState<Tab>(marketplace ? "marketplace" : "scouted");

  const { isBusiness } = useAccountTone();
  if (isBusiness && !marketplace) return <ManageOpportunities company />;

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
        <GigsViewToggle value={tab} onChange={setTab} />
      </EditorialPageHero>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {tab === "scouted" ? <ScoutedGigsSection /> : <OpportunitiesFeed />}
      </div>
    </div>
  );
};

export default Opportunities;
