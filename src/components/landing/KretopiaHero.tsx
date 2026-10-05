/**
 * KretopiaHero — Section 1 of the Kretopia landing page.
 *
 * v8: Kreto mascot = Kreto_06_Waving, body perfectly still, only the hand waves.
 *
 * MASCOT — replaces the former <KretoCharacter variant="hero-wave" />, with
 * the exact same box and position: 180px from `lg`, 300px from 1440px,
 * `bottom-4`, `right-6` / `right-16`, hidden below `lg` (unchanged).
 * The 6-frame animated WebP bobbed the whole body and ran at ~4 fps, so it
 * looked jumpy. Kreto is now two lossless layers cut from the very same HD
 * art (768px): the BODY (never moves) and the raised forearm + HAND, which
 * pivots around the elbow with a compositor-driven transform (60 fps, no
 * decoding, no timers, no blob). At rest, body + arm are pixel-identical to
 * the original frame. Hover (mouse) or touch plays one fast wave. ~185 KB
 * in total instead of ~1.3 MB. See <KretoWave /> below.
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
 * The gradient line uses the same staggered word reveal as the first line,
 * but without per-word CSS filter: a filtered descendant of a
 * background-clip:text parent disappears in Chromium after the animation.
 * Its own padding preserves the gradient's glyph edges.
 */
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { analytics } from "@/lib/analytics";
import { trackLandingCta } from "@/lib/landingFunnel";
import { BrandLogo } from "@/components/BrandLogo";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";
import { GlassCta } from "@/components/ui/glass-cta";
// Reflected artwork imported through Vite: hashed URL in production,
// no hand-written path to maintain. Both files are well over 4 KB, so never inlined as base64.
import kretoBodyUrl from "@/assets/brand/kreto/hero-reflection-body.webp";
import kretoArmUrl from "@/assets/brand/kreto/hero-reflection-arm.webp";

/** Headline, split into words per line so each can resolve out of a blur on
 *  load. Spacing between words comes from a margin on every span but the
 *  line's last, not a text-node space (which is what was collapsing). */
const LINE_1 = ["Find", "work", "that", "fits"];
const LINE_2 = ["what", "you", "do"];

// Sampled from /logokretopia-removebg-preview.png — see file header. The
// stops now live once in index.css (--k-text-gradient) because every
// coloured text on the landing page wears this same gradient; the hero
// reads it from there instead of keeping its own copy, so it can't drift.
const KRETO_LOGO_GRADIENT = "var(--k-text-gradient)";

const ctaFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const wordVariants = (reducedMotion: boolean, gradientText = false) =>
  reducedMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 18, ...(gradientText ? {} : { filter: "blur(8px)" }) },
        show: { opacity: 1, y: 0, ...(gradientText ? {} : { filter: "blur(0px)" }), transition: { duration: 0.6, ease: [0.2, 0.65, 0.3, 0.95] as const } },
      };

/* -------------------------------------------------------------------------- */
/*  Kreto mascot — Kreto_06_Waving (HD): still body, waving hand              */
/* -------------------------------------------------------------------------- */

/** Source art is 768×768 px. `body` = Kreto without his raised forearm + hand;
 *  `arm` = that forearm + hand only (194×174 crop of the same art, same pixels). */
const ART = 768;
const ARM = { x: 487, y: 318, w: 194, h: 174, pivotX: 500, pivotY: 452 } as const; // pivot = elbow

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/** The arm sits exactly over the body at rest. Everything is in % of the 768px art,
 *  so it follows the 180px / 300px box with no JS measuring. `will-change` keeps this
 *  tiny layer on the compositor, so the wave stays at full frame rate. */
const ARM_STYLE: CSSProperties = {
  left: pct(ARM.x, ART),
  top: pct(ARM.y, ART),
  width: pct(ARM.w, ART),
  height: pct(ARM.h, ART),
  transformOrigin: `${pct(ARM.pivotX - ARM.x, ARM.w)} ${pct(ARM.pivotY - ARM.y, ARM.h)}`,
  willChange: "transform",
};

/** One fast wave (~1.1 s, ~3 swings, fading out): [time ms, degrees].
 *  Negative = toward Kreto's head, positive = outward; the pose at rest (0°) is the outer limit
 *  of the swing, so the part of the head hidden behind the thumb is never uncovered. */
const WAVE_STEPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [120, -13],
  [270, 2],
  [420, -12],
  [570, 2],
  [720, -10],
  [860, 1],
  [990, -6],
  [1120, 0],
];
const WAVE_MS = WAVE_STEPS[WAVE_STEPS.length - 1][0];
const WAVE_EASE = "cubic-bezier(0.37, 0, 0.63, 1)"; // ease-in-out sine: natural pendulum feel
const WAVE_KEYFRAMES: Keyframe[] = WAVE_STEPS.map(([t, deg]) => ({
  offset: t / WAVE_MS,
  transform: `rotate(${deg}deg)`,
  easing: WAVE_EASE,
}));

const KretoWave = memo(function KretoWave({ reducedMotion }: { reducedMotion: boolean }) {
  const bodyRef = useRef<HTMLImageElement>(null);
  const armRef = useRef<HTMLImageElement>(null);
  const waveRef = useRef<Animation | null>(null);
  const [ready, setReady] = useState(false);

  // Show Kreto only once both layers are decoded, so the hand never pops in late.
  const checkReady = useCallback(() => {
    const body = bodyRef.current;
    const arm = armRef.current;
    if (body?.complete && body.naturalWidth > 0 && arm?.complete && arm.naturalWidth > 0) setReady(true);
  }, []);

  useEffect(() => {
    checkReady(); // covers images already in cache
    return () => waveRef.current?.cancel();
  }, [checkReady]);

  /** Hover (mouse) / touch (finger, pen): one wave at a time, starts instantly. */
  const play = useCallback(() => {
    const arm = armRef.current;
    if (!ready || reducedMotion || waveRef.current || !arm || typeof arm.animate !== "function") return;
    const wave = arm.animate(WAVE_KEYFRAMES, { duration: WAVE_MS });
    waveRef.current = wave;
    wave.onfinish = wave.oncancel = () => {
      waveRef.current = null;
    };
  }, [ready, reducedMotion]);

  return (
    // No opacity / transform / z-index on this wrapper on purpose: that keeps it
    // out of its own stacking context, so the hit zone below (z-[2]) can sit above
    // the hero content (z-[1]) for hover, while the figure stays *under* the
    // bottom dissolve overlay exactly like the former one did.
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-4 right-6 hidden h-[180px] w-[180px] select-none lg:block min-[1440px]:right-16 min-[1440px]:h-[300px] min-[1440px]:w-[300px]"
    >
      {/* The figure: still body + waving arm (opacity-95 lives here, as before). */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${ready ? "opacity-95" : "opacity-0"}`}>
        <img
          ref={bodyRef}
          src={kretoBodyUrl}
          alt=""
          width={ART}
          height={ART}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={checkReady}
          className="absolute inset-0 h-full w-full select-none object-contain"
        />
        <img
          ref={armRef}
          src={kretoArmUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={checkReady}
          style={ARM_STYLE}
          className="absolute select-none"
        />
      </div>

      {/* Invisible hit zone: the wrapper is pointer-events-none like before. */}
      <div
        className="pointer-events-auto absolute inset-0 z-[2] touch-manipulation [-webkit-tap-highlight-color:transparent]"
        onPointerEnter={play}
        onPointerDown={play}
      />
    </div>
  );
});

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
            <span className="block" style={{ lineHeight: 1.3, paddingTop: "0.05em", paddingBottom: "0.2em" }}>
              <span
                style={{
                  display: "inline-block",
                  backgroundImage: KRETO_LOGO_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  // Same fix as .k-gradient-text/.landing-accent's own
                  // shared CSS rule (index.css), applied directly since
                  // this span uses raw inline styles, not those classes.
                  // Confirmed live at 320px: with zero padding, "do" (the
                  // last word, no trailing margin) sits flush against
                  // this box's right edge and Chromium fails to paint
                  // background-clip:text right at that boundary -- the
                  // word silently disappears while "what"/"you" (which
                  // have breathing room from their own trailing margin)
                  // render fine. padding-inline gives the clip area
                  // slack; margin-inline cancels the size increase.
                  paddingInline: "0.16em",
                  marginInline: "-0.16em",
                  paddingBlock: "0.22em",
                  marginBlock: "-0.22em",
                }}
              >
                {LINE_2.map((word, wi) => (
                  <motion.span
                    key={wi}
                    className={`inline-block${wi < LINE_2.length - 1 ? " mr-[0.28em]" : ""}`}
                    variants={wordVariants(reducedMotion, true)}
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
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

        {/* Neutral secondary action follows the active theme; the title
            remains the only gradient text in this hero. */}
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
                  label: "Create Passport",
                  variant: "signal_field",
                })
              }
              className="hero-passport-cta w-full sm:w-auto"
            >
              Create Passport
            </GlassCta>

            <Link
              to="/auth?next=/scout&src=hero_explore"
              onClick={() =>
                trackLandingCta("hero_explore_opportunities", "hero", {
                  label: "Explore Opportunities",
                  variant: "signal_field",
                })
              }
              className={`group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-border px-7 py-3.5 text-base font-semibold text-foreground transition-colors duration-200 hover:-translate-y-0.5 hover:border-foreground/35 ${ctaFocusRing} focus-visible:ring-foreground/50`}
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Explore Opportunities
            </Link>
          </div>

          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            Free to start. No credit card needed.
          </p>
        </motion.div>
      </div>

      {/* Big main Kreto figure — Kreto_06_Waving (HD), still body + waving hand, same
          sizes and position as the former KretoCharacter: 180px (lg) → 300px (≥1440px). */}
      <KretoWave reducedMotion={reducedMotion} />

      {/* bottom dissolve to next section */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, hsl(var(--background)))",
        }}
      />
    </section>
  );
};

export default KretopiaHero;