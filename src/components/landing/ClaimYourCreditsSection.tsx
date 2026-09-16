import { Link } from "react-router-dom";
import { Search, Database, ArrowRight } from "lucide-react";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";

interface Props {
  onSearchSubmit?: (q: string) => void;
}

/**
 * THE HOOK — single dedicated section for the "search your name → claim your credits" funnel.
 * IMDb moment, surfaced once and only once.
 */
export const ClaimYourCreditsSection = ({ onSearchSubmit }: Props) => {
  return (
    <section className="px-4 sm:px-6 py-14 sm:py-20">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5">
            <Database className="h-3 w-3" />
            Verified Creative Credits
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.03em] leading-[1.05] text-foreground mb-4">
            Your work is already out there.<br />
            <span className="text-primary">Make it count.</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Type your name. We'll surface every credit, feature, and project we can find on the web —
            verified and yours to claim. Like IMDb, but for every creative industry.
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="relative rounded-2xl p-[2px] bg-gradient-to-r from-energy via-primary to-energy shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]">
            <div className="rounded-[14px] bg-card">
              <UnifiedSearchDropdown
                variant="hero"
                placeholder="Search your name…"
                onQuerySubmit={onSearchSubmit}
              />
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/70 mt-3">
            Free · Takes 30 seconds · Your credits become a verified portfolio
          </p>

          <div className="text-center mt-5">
            <Link
              to="/auth?tab=signup"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-energy transition-colors"
            >
              Or skip search and start fresh <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
