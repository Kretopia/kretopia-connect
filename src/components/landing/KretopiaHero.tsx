/**
 * KretopiaHero — Section 1 of the Kretopia landing page.
 *
 * v5: three changes.
 *
 * 1. VERTICAL CENTERING — the content block was pinned near the top by a
 *    large, asymmetric pt-16/24/28 (pushing it down from the top) paired
 *    with an even larger pb-20/28, which read as "everything sitting too
 *    low". The section now uses `min-h-[calc(100svh-4rem)]
 *    sm:min-h-[calc(100svh-5rem)]` + `flex items-center` so the whole
 *    block is genuinely centered in the viewport space actually available
 *    below the sticky navbar — 4rem/5rem (64px/80px) match the exact
 *    mobile/desktop header-height constants Navbar.tsx and
 *    FixedProgressiveCard.tsx already use elsewhere (their own `top`
 *    offset), not a guessed number. Inner vertical padding is now a
 *    modest, symmetric py-12/16 safety margin, not the thing doing the
 *    positioning.
 *
 * 2. CTA BALANCE — both buttons are now equal-width (`w-full sm:w-auto`,
 *    capped at max-w-xs on mobile so they don't stretch edge-to-edge),
 *    share the same hover-lift + focus-visible ring treatment now used
 *    across the other landing sections (ClosingCTASection,
 *    ForOrganisationsSection) for visual consistency site-wide.
 *
 * 3. SEARCH — no longer a bespoke input + custom fetch/debounce/dropdown
 *    against a guessed endpoint. Navbar.tsx already renders the app's
 *    real search component, `UnifiedSearchDropdown` from
 *    "@/components/search/UnifiedSearchDropdown", with a `variant="hero"`
 *    it already supports (used in Navbar's own mobile search sheet) — so
 *    the hero now renders that exact component instead of reimplementing
 *    it. Same component, same fetch, same data, same navigation behavior
 *    as the navbar's search, by construction — not a parallel
 *    implementation that happens to match. This removes the
 *    WorkOpportunity type, searchWorkOpportunities, highlightMatch, and
 *    all of the search-related state/handlers from v4; `onSearchSubmit`
 *    is gone from the props too since UnifiedSearchDropdown owns its own
 *    submit/navigate behavior the same way it already does in Navbar
 *    (no override passed there either). If anything upstream still passes
 *    `onSearchSubmit` to <KretopiaHero>, that prop is now a no-op and can
 *    be removed at the call site.
 *
 * Background: "Verified Creative Signal Field" — unchanged (see
 * LANDING_HERO_SIGNAL_FIELD_AUDIT.md).
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { analytics } from "@/lib/analytics";
import { trackLandingCta } from "@/lib/landingFunnel";
import { BrandLogo } from "@/components/BrandLogo";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";

/** Headline, split into words per line so each can resolve out of a blur on
 *  load. Spacing between words comes from a margin on every span but the
 *  line's last, not a text-node space (which is what was collapsing). */
const LINE_1 = ["Find", "work", "that", "fits"];
const LINE_2 = ["what", "you", "do."];

const ctaFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070D]";

const wordVariants = (reducedMotion: boolean) =>
  reducedMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.2, 0.65, 0.3, 0.95] as const } },
      };

export const KretopiaHero = () => {
  const reducedMotion = useReducedMotion();

  // Signal field pointer response — unchanged.
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const smoothX = useSpring(pointerX, { stiffness: 40, damping: 22, mass: 0.6 });
  const smoothY = useSpring(pointerY, { stiffness: 40, damping: 22, mass: 0.6 });
  const fieldX = useTransform(smoothX, [0, 1], [-24, 24]);
  const fieldY = useTransform(smoothY, [0, 1], [-14, 14]);

  const handlePointerMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width);
    pointerY.set((e.clientY - rect.top) / rect.height);
  };
  const handlePointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  useEffect(() => {
    analytics.featureUsed("landing_hero_viewed", { location: "hero" });
    // Section-view tracking for "kretopia-hero" is handled generically by
    // LandingFunnelTracker (observes every real section[id] in the DOM) --
    // not duplicated here.
  }, []);

  return (
    <section
      id="kretopia-hero"
      className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden sm:min-h-[calc(100svh-5rem)]"
      style={{ backgroundColor: "#05070D" }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      {/* warm vignette — barely there */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 80% 20%, rgba(120, 70, 40, 0.14), transparent 55%), radial-gradient(80% 60% at 0% 100%, rgba(0,0,0,0.6), transparent 60%)",
        }}
      />

      {/* Verified Creative Signal Field — unchanged. aria-hidden --
          purely decorative, no live data implied. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ x: fieldX, y: fieldY }}
      >
        <div
          className="h-[70vh] w-[70vh] max-h-[560px] max-w-[560px] rounded-full blur-[90px]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--secondary) / 0.55) 0%, hsl(var(--energy) / 0.22) 42%, transparent 72%)",
          }}
        />
      </motion.div>

      {/* Faint signal grid, masked to fade out — the "machine" layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(70% 55% at 50% 35%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(70% 55% at 50% 35%, #000 0%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[900px] flex-col items-center px-5 py-12 text-center sm:px-8 sm:py-16 lg:px-12">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <BrandLogo size="md" showBeta />
        </motion.div>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="landing-eyebrow mb-6"
        >
          For creative professionals
        </motion.p>

        {/* Headline — words spaced with a margin on each span, not a
            trailing space character, so spacing can't collapse. */}
        <h1 className="landing-h1 landing-glow max-w-full mx-auto">
          <motion.span
            className="block"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: reducedMotion ? 0 : 0.05 } } }}
          >
            <span className="block">
              {LINE_1.map((word, wi) => (
                <motion.span
                  key={wi}
                  className={`inline-block${wi < LINE_1.length - 1 ? " mr-[0.28em]" : ""}`}
                  variants={wordVariants(reducedMotion)}
                >
                  {word}
                </motion.span>
              ))}
            </span>
            <span className="landing-accent block">
              {LINE_2.map((word, wi) => (
                <motion.span
                  key={wi}
                  className={`inline-block${wi < LINE_2.length - 1 ? " mr-[0.28em]" : ""}`}
                  variants={wordVariants(reducedMotion)}
                >
                  {word}
                </motion.span>
              ))}
            </span>
          </motion.span>
        </h1>

        {/* "Works" search — the app's real UnifiedSearchDropdown (same
            component and "hero" variant Navbar.tsx already uses in its
            own mobile search sheet), not a bespoke reimplementation. */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative mt-8 sm:mt-9 w-full max-w-[38rem] mx-auto"
        >
          <p className="landing-eyebrow mb-4 sm:mb-5 block text-center">Find work on Kretopia</p>
          <UnifiedSearchDropdown variant="hero" placeholder="Search by role, skill, location, type of work…" />
        </motion.div>

        {/* CTA pair — equal width, same hover-lift + focus-ring treatment
            used across the other landing sections for balance/consistency. */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-9 sm:mt-10 flex w-full flex-col items-center gap-4"
        >
          <div className="flex w-full max-w-xs flex-col items-center justify-center gap-3 sm:max-w-none sm:w-auto sm:flex-row">
            <Link
              to="/auth?tab=signup&src=hero_passport"
              onClick={() =>
                trackLandingCta("hero_build_passport", "hero", {
                  label: "Build My Passport",
                  variant: "signal_field",
                })
              }
              className={`btn-landing-primary group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${ctaFocusRing} focus-visible:ring-[hsl(var(--energy))]/70`}
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Build My Passport
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>

            <Link
              to="/auth?next=/scout&src=hero_explore"
              onClick={() =>
                trackLandingCta("hero_explore_opportunities", "hero", {
                  label: "Explore Opportunities",
                  variant: "signal_field",
                })
              }
              className={`btn-glass btn-glass-outline inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${ctaFocusRing} focus-visible:ring-white/40`}
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Explore Opportunities
            </Link>
          </div>

          <p className="text-xs text-white/45" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            Free to start. No credit card needed.
          </p>
        </motion.div>
      </div>

      {/* Big main Kreto figure — unchanged. */}
      <div className="pointer-events-none absolute bottom-4 right-6 hidden lg:block min-[1440px]:hidden opacity-95">
        <KretoCharacter variant="main" size={180} floatAmplitude={0} />
      </div>
      <div className="pointer-events-none absolute bottom-4 right-16 hidden min-[1440px]:block opacity-95">
        <KretoCharacter variant="main" size={300} floatAmplitude={0} />
      </div>

      {/* bottom dissolve to next section */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(5,7,13,1))",
        }}
      />
    </section>
  );
};

export default KretopiaHero;