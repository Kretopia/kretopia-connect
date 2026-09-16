import { Link } from "react-router-dom";
import { Rocket, ShieldCheck, ArrowRight } from "lucide-react";

/**
 * Compact ThriveFund teaser — one card, not a full section.
 * Replaces the heavy ThriveFundShowcase on the landing page so it stops competing with the hero.
 */
export const ThriveFundTeaserCard = () => {
  return (
    <section className="px-4 sm:px-6 py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl">
        <Link
          to="/fund"
          className="group relative block overflow-hidden rounded-2xl border border-primary/25 bg-cinematic p-5 sm:p-6 hover:border-primary/50 transition-all"
        >
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-energy mb-1.5">
                Now Live · ThriveFund
              </p>
              <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight mb-1">
                Crowdfund your next project.
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-3">
                Verified creators only · Milestone-based payouts · Built for films, albums, fashion drops, and creator projects.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                  Explore campaigns <ArrowRight className="h-3.5 w-3.5" />
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                  <ShieldCheck className="h-3 w-3" /> 18+ · ID verified · Moderated
                </span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
};
