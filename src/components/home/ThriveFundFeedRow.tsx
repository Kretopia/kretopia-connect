import { Link } from "react-router-dom";
import { Rocket, ArrowRight } from "lucide-react";
import { useActiveCampaigns } from "@/hooks/useThriveFund";
import { CampaignCard } from "@/components/thrivefund/CampaignCard";

export const ThriveFundFeedRow = () => {
  const { data: campaigns, isLoading } = useActiveCampaigns();

  if (isLoading) return null;
  const list = (campaigns ?? []).slice(0, 6);

  return (
    <section className="mb-8 scroll-mt-14">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">ThriveFund — Back verified creators</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-energy/15 border border-energy/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-energy">
            <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse shadow-[0_0_8px_hsl(var(--energy))]" />
            Live
          </span>
        </div>
        <Link to="/fund" className="text-xs font-semibold inline-flex items-center gap-1 text-energy hover:text-energy/80 transition">
          Explore <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {list.length === 0 ? (
        <Link
          to="/fund"
          className="block rounded-xl border border-dashed border-energy/40 bg-gradient-to-br from-primary/10 via-background to-energy/10 p-5 hover:from-primary/15 hover:to-energy/20 transition shadow-glow-lime"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-energy/20 border border-energy/50 flex items-center justify-center shrink-0 shadow-[0_0_20px_hsl(var(--energy)/0.4)]">
              <Rocket className="h-5 w-5 text-energy" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Crowdfunding for verified creatives</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Back music, film and creative projects from verified creators — or launch your own.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-energy shrink-0" />
          </div>
        </Link>
      ) : (
        <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 snap-x snap-mandatory">
            {list.map((c) => (
              <div key={c.id} className="snap-start shrink-0 w-[260px]">
                <CampaignCard campaign={c} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
