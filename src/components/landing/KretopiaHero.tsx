/**
 * KretopiaHero — Section 1 of the Kretopia landing page.
 *
 * v10: Waving is the official 3D render, in HD. The 768px chibi art it used before
 * was a different character from the base Kreto (smaller head, finger gloves) and was
 * stretched past its resolution, which showed as pixels and mismatched colours. The two
 * layers are now cut from kreto-mascot-hero-wave.png (1378x1141, the render the base
 * Kreto and Flying come from), recolored to Flying's measured shell (pearl white-lavender,
 * mean RGB ~ 226,219,235), with the rim glow and halo removed, the ear lenses kept in
 * their own gloss and the eyes and K untouched. He is fitted to Flying's helmet size
 * (HELMET_OF_BOX) and turns toward the pointer in real perspective, his forearm sitting
 * in front of his body, with a contact shadow under his feet. The wave itself is still
 * a compositor transform on the arm layer, pivoting at the elbow.
 *
 * v9: The CTA pair wears the opt-in `k-cta-future` finish and the search field the sober
 * `k-search-hero` hairline (both in index.css); search and CTAs share one column.
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
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { analytics } from "@/lib/analytics";
import { trackLandingCta } from "@/lib/landingFunnel";
import { BrandLogo } from "@/components/BrandLogo";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";
import { GlassCta, OutlineCta } from "@/components/ui/glass-cta";
// HD artwork imported through Vite: hashed URL in production, no hand-written path to maintain.
// Both files are well over 4 KB, so never inlined as base64.
import kretoBodyUrl from "@/assets/brand/kreto/hero-wave-hd-body.webp";
import kretoArmUrl from "@/assets/brand/kreto/hero-wave-hd-arm.webp";

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

const wordVariants = (reducedMotion: boolean, _gradientText = false) =>
  reducedMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 1, y: 4 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.18, ease: [0.2, 0.65, 0.3, 0.95] as const },
        },
      };

/* -------------------------------------------------------------------------- */
/*  Kreto mascot — the official 3D render, waving: still body, waving hand     */
/* -------------------------------------------------------------------------- */

/** The art is cut from the official render (kreto-mascot-hero-wave.png, 1378x1141: the same character
 *  as the base Kreto and Flying), not from the 768px chibi art the hero used before, so at 300px it is
 *  still downscaled on a 2x screen instead of stretched. `body` = Kreto without his forearm + hand,
 *  a 908x1076 canvas; `arm` = that forearm + hand (267x316 at 641,344 of the same canvas, same pixels,
 *  overlapping the joint by a few px so the two layers never leave a seam). */
const ART = { w: 908, h: 1076 } as const;
const ARM = { x: 641, y: 344, w: 267, h: 316, pivotX: 39, pivotY: 270 } as const; // pivot = elbow, in arm px

/** Waving and Flying share one box (180px, 300px from 1440px). The figure is fitted so his helmet is
 *  0.65 of the box wide (Flying's is 0.677): his silhouette is then within ~7% of Flying's height and
 *  the takeoff swap does not jump. 754 = the helmet's width in canvas px. His raised hand reaches 5%
 *  past the box's right edge; his feet sit on the box's bottom edge. */
const HELMET_PX = 754;
const HELMET_OF_BOX = 0.65;
const FIT = HELMET_OF_BOX / HELMET_PX;
const FIGURE_STYLE: CSSProperties = {
  width: `${ART.w * FIT * 100}%`,
  height: `${ART.h * FIT * 100}%`,
  right: "-5%",
  bottom: "-1%",
};

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/** The arm sits exactly over the body at rest. Everything is in % of the canvas, so it follows the
 *  180px / 300px box with no JS measuring. `will-change` keeps this layer on the compositor. */
const ARM_STYLE: CSSProperties = {
  left: pct(ARM.x, ART.w),
  top: pct(ARM.y, ART.h),
  width: pct(ARM.w, ART.w),
  height: pct(ARM.h, ART.h),
};
const ARM_IMG_STYLE: CSSProperties = {
  transformOrigin: `${pct(ARM.pivotX, ARM.w)} ${pct(ARM.pivotY, ARM.h)}`,
  willChange: "transform",
};

/** One fast wave (~1.1 s, ~3 swings, fading out): [time ms, degrees].
 *  Negative = toward Kreto's head, positive = outward; rest (0°) is the outer limit of the swing, so
 *  nothing behind the hand is ever uncovered. The mitten passes in front of the helmet's rim at the
 *  top of the swing, which is why the amplitude is smaller than the old 4-finger hand's. */
const WAVE_STEPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [120, -10],
  [270, 2],
  [420, -9],
  [570, 2],
  [720, -7],
  [860, 1],
  [990, -4],
  [1120, 0],
];
const WAVE_MS = WAVE_STEPS[WAVE_STEPS.length - 1][0];
const WAVE_EASE = "cubic-bezier(0.37, 0, 0.63, 1)"; // ease-in-out sine: natural pendulum feel
const WAVE_KEYFRAMES: Keyframe[] = WAVE_STEPS.map(([t, deg]) => ({
  offset: t / WAVE_MS,
  transform: `rotate(${deg}deg)`,
  easing: WAVE_EASE,
}));

/** How far he turns toward the pointer (degrees) and how far his forearm sits in front of his body
 *  (px), which is what makes the turn read as depth rather than as a flat card tilting. */
const TILT_Y = 10;
const TILT_X = 6;
const ARM_DEPTH_PX = 22;
const PERSPECTIVE_PX = 900;

/** A layer moved toward the viewer by z is magnified by P / (P - z) about the perspective origin (the
 *  figure's centre). Scaling it by the inverse about that same point, written in the arm's own box,
 *  keeps the forearm exactly on his body at rest; only a turn reveals the offset. */
const ARM_FRONT_STYLE: CSSProperties = {
  transform: `translateZ(${ARM_DEPTH_PX}px) scale(${(PERSPECTIVE_PX - ARM_DEPTH_PX) / PERSPECTIVE_PX})`,
  transformOrigin: `${pct(ART.w / 2 - ARM.x, ARM.w)} ${pct(ART.h / 2 - ARM.y, ARM.h)}`,
};

const KretoWave = memo(function KretoWave({
  reducedMotion,
  pointerX,
  pointerY,
}: {
  reducedMotion: boolean;
  /** The hero's smoothed pointer position, 0..1 across the section. */
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
}) {
  // He sits at the right of the section (~0.85 across): left of him he turns left, above him he looks up.
  const rotateY = useTransform(pointerX, [0, 0.85, 1], [-TILT_Y, 0, TILT_Y * 0.3]);
  const rotateX = useTransform(pointerY, [0, 0.8, 1], [TILT_X, 0, -TILT_X * 0.5]);
  const bodyRef = useRef<HTMLImageElement>(null);
  const armRef = useRef<HTMLImageElement>(null);
  const waveRef = useRef<Animation | null>(null);
  const [ready, setReady] = useState(false);
  const alive = useRef(true);

  // Show Kreto only once both layers are downloaded AND decoded: `complete` only says the bytes
  // arrived, and a hand painted before the body reads as a floating glove.
  const checkReady = useCallback(() => {
    const body = bodyRef.current;
    const arm = armRef.current;
    if (!(body?.complete && body.naturalWidth > 0 && arm?.complete && arm.naturalWidth > 0)) return;
    const show = () => {
      if (alive.current) setReady(true);
    };
    if (typeof body.decode === "function" && typeof arm.decode === "function") {
      Promise.all([body.decode(), arm.decode()]).then(show, show);
    } else {
      show();
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    checkReady(); // covers images already in cache
    return () => {
      alive.current = false;
      waveRef.current?.cancel();
    };
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

  // Greet once on arrival, then retain the existing hover/touch wave.
  useEffect(() => {
    play();
  }, [play]);

  return (
    // No opacity / transform / z-index on this wrapper on purpose: that keeps it
    // out of its own stacking context, so the hit zone below (z-[2]) can sit above
    // the hero content (z-[1]) for hover, while the figure stays *under* the
    // bottom dissolve overlay exactly like the former one did.
    <div
      aria-hidden
      data-kreto-wave
      className="pointer-events-none absolute bottom-4 right-6 hidden h-[180px] w-[180px] select-none lg:block min-[1440px]:right-16 min-[1440px]:h-[300px] min-[1440px]:w-[300px]"
    >
      {/* Soft contact shadow under his feet: grounds the figure instead of leaving it on the page. */}
      <div
        className={`absolute bottom-[1%] left-[26%] h-[7%] w-[46%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(24,10,52,0.34),transparent)] blur-[3px] transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      />

      {/* The figure box carries the perspective; inside it he turns toward the pointer and his forearm
          sits in front of his body, so the turn shows depth. All of it is compositor work. */}
      <div
        className={`absolute transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ ...FIGURE_STYLE, perspective: PERSPECTIVE_PX }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            transformOrigin: "50% 92%",
            willChange: reducedMotion ? undefined : "transform",
            rotateX: reducedMotion ? 0 : rotateX,
            rotateY: reducedMotion ? 0 : rotateY,
          }}
        >
          <img
            ref={bodyRef}
            src={kretoBodyUrl}
            alt=""
            width={ART.w}
            height={ART.h}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            draggable={false}
            onLoad={checkReady}
            className="absolute inset-0 h-full w-full select-none"
          />
          <div className="absolute" style={reducedMotion ? ARM_STYLE : { ...ARM_STYLE, ...ARM_FRONT_STYLE }}>
            <img
              ref={armRef}
              src={kretoArmUrl}
              alt=""
              loading="eager"
              decoding="async"
              draggable={false}
              onLoad={checkReady}
              style={ARM_IMG_STYLE}
              className="block h-full w-full select-none"
            />
          </div>
        </motion.div>
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
        {/* warm vignette — barely there (dropped in Daylight via data-hero-vignette) */}
        <div
          data-hero-vignette
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 80% 20%, rgba(96, 52, 190, 0.14), transparent 55%), radial-gradient(80% 60% at 0% 100%, rgba(0,0,0,0.6), transparent 60%)",
          }}
        />

        {/* Verified Creative Signal Field — now the exact logo gradient
            (see file header), heavily blurred and dimmed via opacity so
            it still reads as an ambient glow, not a literal logo replica
            plastered across the background. */}
        <motion.div className="absolute inset-0 flex items-center justify-center" style={{ x: fieldX, y: fieldY }}>
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
          className="mb-5"
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
            variants={{ show: { transition: { staggerChildren: 0 } } }}
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
          transition={{ duration: 0.2 }}
          className="relative mt-9 sm:mt-10 w-full max-w-[34rem] mx-auto"
        >
          <UnifiedSearchDropdown variant="hero" placeholder="People, projects, opportunities…" />
        </motion.div>

        {/* Neutral secondary action follows the active theme; the title
            remains the only gradient text in this hero. */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6 sm:mt-7 flex w-full flex-col items-center gap-4"
        >
          {/* Equal grid tracks: one column on a phone, two equal columns from `sm`,
              so the pair stays level whatever the labels' widths. */}
          <div className="grid w-full max-w-[34rem] grid-cols-1 gap-3 sm:grid-cols-2">
            <GlassCta
              to="/passport"
              size="lg"
              data-cta="primary"
              onClick={() =>
                trackLandingCta("hero_build_passport", "hero", {
                  label: "Create Passport",
                  variant: "signal_field",
                })
              }
              className="hero-passport-cta k-cta-future w-full"
            >
              Create Passport
            </GlassCta>

            <OutlineCta
              to="/auth?next=/scout&src=hero_explore"
              size="lg"
              data-cta="secondary"
              onClick={() =>
                trackLandingCta("hero_explore_opportunities", "hero", {
                  label: "Explore Opportunities",
                  variant: "signal_field",
                })
              }
              className="k-cta-future w-full"
            >
              Explore Opportunities
            </OutlineCta>
          </div>
        </motion.div>
      </div>

      {/* Big main Kreto figure — Kreto_06_Waving (HD), still body + waving hand, same
          sizes and position as the former KretoCharacter: 180px (lg) → 300px (≥1440px). */}
      <KretoWave reducedMotion={reducedMotion} pointerX={smoothX} pointerY={smoothY} />

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
