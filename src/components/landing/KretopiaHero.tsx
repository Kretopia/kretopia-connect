/**
 * KretopiaHero — Section 1 of the Kretopia landing page.
 *
 * v6: hero-scoped logo-accurate gradient + gradient-text clipping fix.
 *
 * GRADIENT — sampled directly from the actual Kretopia "K" logo (pixel
 * samples, not eyeballed): blue #4012F8 at the top of the vertical stroke,
 * through purple #A516C5, to pink/magenta #F62489, to orange #FFA722 at
 * the diagonal's tip. KRETO_LOGO_GRADIENT below is that exact 4-stop
 * gradient at 135deg (matches the logo's own top-left-to-bottom-right
 * flow). It's defined and applied ONLY inside this file — not written
 * into any shared class/token — so it can't leak onto ClosingCTASection,
 * ForOrganisationsSection, or anywhere else that reuses
 * .btn-landing-primary/.landing-glow. Applied to: the accent headline
 * line, both CTA buttons (primary as a fill, secondary as a gradient
 * border so it still reads as secondary), and the signal field. Small
 * utility text (eyebrow labels, the "Free to start" line) stays plain —
 * gradient-filled text at that size reads as muddy, not on-brand.
 *
 * CLIPPING FIX ("what you do." cut in half) — this is the classic
 * `background-clip: text` artifact: WebKit/Blink clip gradient text
 * tighter than normal glyph rendering, so ascenders/descenders get cut
 * unless the element carries its own extra vertical padding on top of
 * line-height. The earlier lineHeight:1.25 on the H1 wasn't enough
 * because it's a container-level fix for a per-line clipping problem.
 * Fixed at the source instead: the gradient span itself now carries
 * lineHeight:1.3 + paddingTop/paddingBottom, self-contained regardless of
 * the H1's own shared line-height, and doesn't depend on any gradient
 * *class* for the fill itself -- only on the shared --k-text-gradient
 * value (index.css), which every other coloured text on the page reads too.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { analytics } from "@/lib/analytics";
import { trackLandingCta } from "@/lib/landingFunnel";
import { BrandLogo } from "@/components/BrandLogo";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";
import { GlassCta } from "@/components/ui/glass-cta";

/** Headline, split into words per line so each can resolve out of a blur on
 *  load. Spacing between words comes from a margin on every span but the
 *  line's last, not a text-node space (which is what was collapsing). */
const LINE_1 = ["Find", "work", "that", "fits"];
const LINE_2 = ["what", "you", "do."];

// Sampled from /logokretopia-removebg-preview.png — see file header. The
// stops now live once in index.css (--k-text-gradient) because every
// coloured text on the landing page wears this same gradient; the hero
// reads it from there instead of keeping its own copy, so it can't drift.
const KRETO_LOGO_GRADIENT = "var(--k-text-gradient)";

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
      className="relative flex min-h-[calc(100svh-4rem)] items-center sm:min-h-[calc(100svh-5rem)]"
      style={{ backgroundColor: "#05070D" }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      {/* Decorative background layer only -- overflow-hidden stays scoped
          here so it clips the vignette/blur/grid to the hero's bounds
          without also clipping UnifiedSearchDropdown's results panel
          below (z-[100], already high enough — this was a clipping bug,
          not a stacking one). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* warm vignette — barely there */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 80% 20%, rgba(120, 70, 40, 0.14), transparent 55%), radial-gradient(80% 60% at 0% 100%, rgba(0,0,0,0.6), transparent 60%)",
          }}
        />

        {/* Verified Creative Signal Field — now the exact logo gradient
            (see file header), heavily blurred and dimmed via opacity so
            it still reads as an ambient glow, not a literal logo replica
            plastered across the background. */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ x: fieldX, y: fieldY }}
        >
          <div
            className="h-[70vh] w-[70vh] max-h-[560px] max-w-[560px] rounded-full blur-[90px]"
            style={{
              background:
                "radial-gradient(circle, #4012F8 0%, #A516C5 30%, #F62489 60%, #FFA722 85%, transparent 100%)",
              opacity: 0.32,
            }}
          />
        </motion.div>

        {/* Faint signal grid, masked to fade out — the "machine" layer */}
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(70% 55% at 50% 35%, #000 0%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(70% 55% at 50% 35%, #000 0%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative z-[1] mx-auto flex w-full max-w-[900px] flex-col items-center px-5 py-12 text-center sm:px-8 sm:py-16 lg:px-12">
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

        {/* Headline — line 2 is the exact logo gradient, self-contained
            (own lineHeight + vertical padding) so it can't be clipped by
            the H1's own shared line-height. Words still spaced with a
            margin on each span, not a trailing space character. */}
        <h1 className="landing-h1 landing-glow max-w-full mx-auto" style={{ lineHeight: 1.25 }}>
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
            <span
              className="block"
              style={{
                backgroundImage: KRETO_LOGO_GRADIENT,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                lineHeight: 1.3,
                paddingTop: "0.05em",
                paddingBottom: "0.2em",
              }}
            >
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

        {/* "Works" search — the app's real UnifiedSearchDropdown,
            untouched internally; its own focus-ring color isn't
            overridden here (see note below on why). */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative mt-8 sm:mt-9 w-full max-w-[38rem] mx-auto"
        >
          <p className="landing-eyebrow mb-4 sm:mb-5 block text-center">Find work on Kretopia</p>
          <UnifiedSearchDropdown variant="hero" placeholder="Search by role, skill, location, type of work…" />
        </motion.div>

        {/* CTA pair — the primary is the site-wide GlassCta (the same
            frosted-glass button as "Explore Verified Credits", just at the
            "lg" size so it stays level with its sibling). The secondary is
            deliberately NOT that button: it keeps its own gradient BORDER
            (two-layer background-image trick: an opaque padding-box fill +
            the logo gradient on the border-box), a hero-scoped inline
            override, nothing shared touched. */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-9 sm:mt-10 flex w-full flex-col items-center gap-4"
        >
          <div className="flex w-full max-w-xs flex-col items-center justify-center gap-3 sm:max-w-none sm:w-auto sm:flex-row">
            <GlassCta
              to="/passport"
              size="lg"
              onClick={() =>
                trackLandingCta("hero_build_passport", "hero", {
                  label: "Build My Passport",
                  variant: "signal_field",
                })
              }
              className="w-full sm:w-auto"
            >
              Build My Passport
            </GlassCta>

            <Link
              to="/auth?next=/scout&src=hero_explore"
              onClick={() =>
                trackLandingCta("hero_explore_opportunities", "hero", {
                  label: "Explore Opportunities",
                  variant: "signal_field",
                })
              }
              className={`group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white/90 transition-transform duration-200 hover:-translate-y-0.5 hover:text-white ${ctaFocusRing} focus-visible:ring-[#F62489]/70`}
              style={{
                fontFamily: "'Satoshi', 'Inter', sans-serif",
                border: "1.5px solid transparent",
                backgroundImage: `linear-gradient(#05070D, #05070D), ${KRETO_LOGO_GRADIENT}`,
                backgroundOrigin: "border-box",
                backgroundClip: "padding-box, border-box",
              }}
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
        <KretoCharacter variant="hero-wave" size={180} floatAmplitude={0} />
      </div>
      <div className="pointer-events-none absolute bottom-4 right-16 hidden min-[1440px]:block opacity-95">
        <KretoCharacter variant="hero-wave" size={300} floatAmplitude={0} />
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