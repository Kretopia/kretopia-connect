/**
 * KretopiaLanding — the cinematic editorial spine.
 *
 * Each section is a chapter, every chapter followed immediately by its own
 * interactive tutorial. No SaaS bloat — no comparison tables, no pricing
 * grids, no feature checklists. The user feels they've walked into a film,
 * not a product page.
 *
 *   I.    Search           — the Hero's live search bar + its tutorial
 *   II.   Passport
  *   III.  Scout
  *   IV.   Match
  *   V.    Studio
  *   VI.   Kreto             — the Executive Producer
  *   VII.  Community
 *
 * Chapter numbers are computed from chapterRegistry.ts, not hand-typed —
 * see that file for the single source of truth ChapterProgressNav also
 * reads from.
 *
 * Performance: only the hero (headline + search) is on the critical path.
 * Chapters remain a separate lazy chunk, requested just after Hero renders.
 * This avoids waiting for scroll or an idle timeout before media can warm.
 * The placeholder reserves height during the download.
 *
 * All routes, auth and search wiring untouched.
 */
import { Suspense, useEffect, useState } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { KretopiaHero } from "@/components/landing/KretopiaHero";
import { ChapterProgressNav } from "@/components/landing/kretopia/ChapterProgressNav";
import { ScrollToTopButton } from "@/components/landing/kretopia/ScrollToTopButton";
import { LandingFunnelTracker } from "@/components/landing/LandingFunnelTracker";
import { KGradientDefs } from "@/components/brand/KGradientDefs";
import { KretoLandingFlight } from "@/components/landing/kretopia/KretoLandingFlight";

const LandingBelowFold = lazy(
  () => import("@/components/landing/kretopia/LandingBelowFold"),
);

interface KretopiaLandingProps {
  onSearchSubmit: (query: string) => void;
}

export const KretopiaLanding = ({ onSearchSubmit }: KretopiaLandingProps) => {
  const [showRest, setShowRest] = useState(false);

  useEffect(() => {
    // Start the separate chapter download immediately after Hero's first
    // render, rather than waiting for scroll or a busy browser's idle slot.
    setShowRest(true);
  }, []);

  return (
    <div className="landing-theme k-gradient-scope relative overflow-x-clip bg-background text-foreground">
      <KGradientDefs />
      {/* I. Hero — critical path */}
      <KretopiaHero />
      <KretoLandingFlight ready={showRest} />

      {showRest ? (
        <Suspense fallback={<div aria-hidden className="min-h-[60vh]" />}>
          <LandingBelowFold />
        </Suspense>
      ) : (
        <div aria-hidden className="min-h-[60vh]" />
      )}

      <ChapterProgressNav ready={showRest} />
      <ScrollToTopButton />
      <LandingFunnelTracker />
    </div>
  );
};

export default KretopiaLanding;
