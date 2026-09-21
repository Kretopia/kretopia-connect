/**
 * ClosingCTASection — Phase 13. The page's final conversion moment, not a
 * feature list.
 *
 * v3 (confirmed gap fix + branding + CTA power pass):
 *
 * - GAP ROOT CAUSE (confirmed against FixedProgressiveCard.tsx): the
 *   component's container is `height: scrollSpan * 100vh`, default
 *   scrollSpan = 1.6 → a 160vh scroll-space block. The pinned content
 *   itself only needs ~100vh (its minHeight is `calc(100vh - <headerOffset>)`).
 *   That leaves ~60vh of scroll where the viewport shows this section's
 *   plain #05070D background around one small, static/animating CTA card
 *   — functionally a page-tall dead zone even though nothing is literally
 *   an empty div. `scrollSpan` is the component's own documented tunable
 *   for exactly this ("how much scroll drives the reveal before the card
 *   releases"), so the fix is passed as a prop here — `scrollSpan={1.2}`
 *   — rather than touching FixedProgressiveCard.tsx's internals or its
 *   default, since that component is shared and changing its default
 *   would silently affect every other section built on it. 1.2 keeps the
 *   six-slot cascade (the component's actual design intent) comfortably
 *   perceptible while cutting the dead scroll span roughly in half to a
 *   third of what it was.
 * - The bottom padding is still pinned via inline style (wins over
 *   whatever .landing-section's own CSS rule sets) and the old plain
 *   `border-t` hard-cut is still a soft accent-gradient seam — both kept
 *   from the previous pass as complementary polish, not the fix itself.
 * - Button copy swapped for something more direct ("Start Your Creative
 *   Passport" — active verb, keeps the brand term, drops the more static
 *   "Claim").
 * - Hover lift + explicit focus-visible ring added to both links (was
 *   relying entirely on btn-landing-primary/underline classes for state,
 *   which may or may not include a visible focus ring on their own).
 *
 * The primary action is still a direct `<Link to="/auth?tab=signup">` —
 * the same destination every other signup CTA on this landing page
 * already uses (ClaimYourCreditsSection, ForOrganisationsSection,
 * ProductSectionThrive, etc.), styled with the same accent pill button.
 *
 * The title is still the live, real social-proof headline — the real
 * creator count from the same public-stats edge function the app already
 * uses elsewhere (no new backend). Fetched on mount; the fallback copy
 * carries no invented number, so a slow network never shows a broken or
 * blank headline — see useCreatorCount below. Unchanged in this pass.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FixedProgressiveCard } from "@/components/landing/kretopia/FixedProgressiveCard";
import { trackLandingCtaClick } from "@/lib/landingMetrics";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "#FF2DA1";

const trackSignupClick = () =>
  trackLandingCtaClick({
    ctaId: "claim_your_creative_passport",
    section: "closing_cta",
    label: "Start Your Creative Passport",
    destinationType: "auth",
  });
const trackSigninClick = () =>
  trackLandingCtaClick({
    ctaId: "closing_cta_signin",
    section: "closing_cta",
    label: "Already have an account? Sign in",
    destinationType: "auth",
  });

/** Real, live creator count from public-stats (same source the rest of the
 *  app already trusts for stats). Null until loaded or if the fetch fails
 *  — callers must have a fallback that reads fine without a number. */
function useCreatorCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("public-stats")
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const n = data?.stats?.creators;
        if (typeof n === "number" && n > 0) setCount(n);
      })
      .catch(() => {
        /* silent — the fallback copy carries no number, nothing to fix */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}

export const ClosingCTASection = () => {
  const creatorCount = useCreatorCount();

  return (
    <section
      id="closing-cta"
      className="landing-section relative"
      style={{ backgroundColor: "#05070D", paddingBottom: "3.5rem" }}
      aria-labelledby="closing-cta-title"
    >
      <FixedProgressiveCard
        scrollSpan={1.2}
        eyebrow={<p className="landing-eyebrow">Get started</p>}
        title={
          <h2 id="closing-cta-title" className="landing-h1 landing-glow">
            {creatorCount ? `Join ${creatorCount}+ creatives` : "Join the creatives"}
            <br />
            <span className="italic pink-glow-breathe" style={{ color: ACCENT }}>already proving their work.</span>
          </h2>
        }
        keyValue={
          // Glow sits behind the button on its own layer rather than as a
          // box-shadow so it can blur past the button's own rounded-full
          // edge without being clipped by btn-glass's overflow:hidden.
          <div className="relative inline-block">
            <div
              aria-hidden
              className="ai-ambient-breathe pointer-events-none absolute -inset-4 rounded-full blur-2xl"
              style={{ background: `radial-gradient(circle, ${ACCENT}55, transparent 70%)` }}
            />
            <Link
              to="/auth?tab=signup&intent=closing_cta&src=closing_cta"
              onClick={trackSignupClick}
              className="btn-landing-primary group relative inline-flex h-auto items-center gap-2 rounded-full px-8 py-4 text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2DA1]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070D]"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Start Your Creative Passport
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
        }
        supportingItem={
          <p className="text-xs text-white/45" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            Free forever · No credit card · 2-minute setup
          </p>
        }
        cta={
          <Link
            to="/auth?src=closing_cta"
            onClick={trackSigninClick}
            className="rounded text-xs font-medium text-white/40 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2DA1]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070D]"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            Already have an account? Sign in
          </Link>
        }
      />

      {/* Soft accent-gradient seam into ForOrganisationsSection, replacing
          the old plain `border-t` hard-cut. Deliberately faint (one thin
          line, no blur) so it reads as continuity rather than a second
          decorative glow competing with the CTA's own ambient glow above
          — "premium, épuré", not layered on top of itself. */}
      <div
        aria-hidden
        className="pointer-events-none mx-auto mt-14 h-px w-full max-w-[420px]"
        style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}55, transparent)` }}
      />

      {/* The "Kretopia / Where Creativity Lives." tagline that used to sit
          here read as an empty, disconnected beat -- direct feedback asked
          for it gone so the section's own bottom padding is what leads
          into the next section, without an extra block of text between
          them. */}
    </section>
  );
};

export default ClosingCTASection;