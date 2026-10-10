/**
 * ChapterSection — full-bleed editorial "movie chapter" for each pillar.
 * One image. One sentence. One accent. Restrained motion.
 */
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Play } from "lucide-react";
import type { TutorialStep } from "./FeatureTutorial";
import { FeatureTutorialPanel } from "./FeatureTutorialPanel";
import { KretopiaFeatureTutorial } from "./KretopiaFeatureTutorial";
import { GlassCta } from "@/components/ui/glass-cta";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { trackLandingCtaClick, type LandingSectionId } from "@/lib/landingMetrics";
import { KretoCharacter, type KretoCharacterVariant } from "@/components/brand/KretoCharacter";

export interface ChapterProps {
  index: string;        // "I", "II", "III"…
  kicker: string;       // "Passport"
  title: React.ReactNode;
  body: string;
  caption: string;
  image: string;
  /** Optional HD video, same frame/aspect as the image -- the image is
   *  kept as the <video>'s poster (first paint + graceful fallback) and
   *  as the alt experience with reduced motion. Autoplays muted/looped. */
  video?: string;
  /** A 16:9 video is shown whole in a 16:9 frame instead of being cropped to
   *  the portrait frame the other chapters use, so it stays at native HD. */
  landscape?: boolean;
  /** Landing overhaul: gradient is intentionally selective, one title per
   *  chosen chapter (Studio, Stages, Scout) rather than every chapter --
   *  omit (the default) to keep this title plain white like the rest. */
  gradientTitle?: boolean;
  /** Corner/eyebrow dot fill -- any valid CSS colour. Neutralized to
   *  "hsl(var(--energy))" at every current call site (was the logo
   *  gradient's violet stop) so these small dots stay "selected few
   *  elements" restrained rather than another spot of colour per chapter. */
  accent: string;
  href: string;
  reverse?: boolean;    // flip layout
  id?: string;          // scroll-to anchor for chapter nav
  /** Interactive tutorial steps, rendered as a full-width panel below the image/text grid. */
  tutorialSteps?: TutorialStep[];
  /** Step-reactive visual preview paired with tutorialSteps in the panel. */
  tutorialVisual?: ComponentType<{ activeStep: number; inView: boolean }>;
  /** Overrides the default "Enter {kicker}" link text. */
  ctaLabel?: string;
  /** Optional compact concept grid rendered between body copy and the CTA. */
  concepts?: { label: string; body: string }[];
  /** Optional single emphasized line rendered just above the CTA. */
  closingLine?: string;
  /** Landing Final Conversion Overhaul §5/§6: when true, the tutorial is
   *  collapsed behind a discreet "See how it works" fingerprint trigger
   *  next to the CTA (KretopiaFeatureTutorial) instead of the always-visible,
   *  auto-playing full-width FeatureTutorialPanel. Opt-in and per-chapter —
   *  omitting it (the default) keeps a chapter's existing behavior exactly
   *  as it was. */
  discreetTutorial?: boolean;
  /** Optional, subtle Kreto silhouette in the image's own bottom-right
   *  corner (inside its existing overflow-hidden frame, so it's naturally
   *  clipped and can never spill into the text column or off-screen on
   *  mobile). Opt-in per chapter — omitting it (the default) keeps a
   *  chapter's image exactly as it was. Reserved for a couple of
   *  strategic chapters, not every one, per the brief's own "subtle...
   *  2-3 sections" guidance. */
  kretoVariant?: KretoCharacterVariant;
}

export const ChapterSection = ({
  index, kicker, title, body, caption, image, video, landscape, accent, href, reverse, id, tutorialSteps, tutorialVisual,
  ctaLabel, concepts, closingLine, discreetTutorial, kretoVariant, gradientTitle,
}: ChapterProps) => {
  const reducedMotion = useReducedMotion();
  const sectionId = (id ?? kicker.toLowerCase()) as LandingSectionId;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  // Autoplay needs two real fixes beyond the `autoplay` attribute alone:
  // (1) React sets `muted` as a JS property, not an HTML attribute
  // (github.com/facebook/react/issues/10389) -- some autoplay-policy
  // checks look for the attribute itself. (2) Chrome pauses an
  // autoplaying video the moment it scrolls off-screen "to save power",
  // but does NOT resume it automatically when it scrolls back into view
  // -- that resume has to be driven explicitly, same IntersectionObserver
  // pattern HoloCard.tsx already uses for its own ambient animation.
  // Rejections are swallowed throughout: blocked autoplay just leaves the
  // poster frame showing, never a broken page.
  useEffect(() => {
    const el = videoRef.current;
    if (!video || !el) return;
    el.setAttribute("muted", "");
    el.muted = true;
    let inView = false;
    // A browser can refuse autoplay (low-power mode, data saver, an
    // autoplay policy). That used to leave the poster up with nothing to
    // tell the visitor: now the refusal shows a Play button, and the first
    // touch, click or key press anywhere on the page starts the video.
    const play = () => {
      if (!inView) return;
      el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    };
    const unlock = () => {
      inView = inView || el.getBoundingClientRect().top < window.innerHeight;
      play();
    };
    const gestures = ["pointerdown", "keydown", "touchend"] as const;
    gestures.forEach((g) => window.addEventListener(g, unlock, { once: true, passive: true }));
    if (typeof IntersectionObserver === "undefined") {
      inView = true;
      el.preload = "auto";
      play();
      return;
    }
    // Full-quality download starts one screen before the video is reached,
    // so it is already sharp when it scrolls in (metadata alone left the
    // poster up until the decoder caught up).
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.preload = "auto";
        near.disconnect();
      },
      { rootMargin: "100% 0px" },
    );
    const watch = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) play();
        else el.pause();
      },
      { threshold: 0.25 },
    );
    near.observe(el);
    watch.observe(el);
    // Re-assert playback when the decoder is ready, when the tab returns, and
    // after a Daylight/Midnight switch: a video that was blocked once should
    // not sit on its poster until the visitor happens to scroll.
    el.addEventListener("canplay", play);
    window.addEventListener("ui-vibe:change", play);
    document.addEventListener("visibilitychange", play);
    return () => {
      near.disconnect();
      watch.disconnect();
      el.removeEventListener("canplay", play);
      window.removeEventListener("ui-vibe:change", play);
      document.removeEventListener("visibilitychange", play);
      gestures.forEach((g) => window.removeEventListener(g, unlock));
    };
  }, [video]);
  return (
    <section
      id={id}
      className="relative overflow-hidden border-t border-white/[0.05]"
    >
      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-36">
        <div className={`grid lg:grid-cols-12 gap-10 lg:gap-16 items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>

          {/* IMAGE */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 1.03 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.1, ease: [0.2, 0.65, 0.3, 0.95] }}
            className="lg:col-span-7 relative"
          >
            <div
              className={`relative overflow-hidden ${
                landscape ? "aspect-video" : "aspect-[4/5] sm:aspect-[5/6] lg:aspect-[4/5]"
              }`}
            >
              {video ? (
                <video
                  ref={videoRef}
                  src={video}
                  poster={image}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={caption}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <img
                  src={image}
                  alt={caption}
                  width={1536}
                  height={1920}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {video && blocked && (
                <button
                  type="button"
                  aria-label={`Play the ${caption} video`}
                  onClick={() => videoRef.current?.play().then(() => setBlocked(false)).catch(() => {})}
                  className="absolute inset-0 z-10 m-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Play className="h-6 w-6 translate-x-0.5" aria-hidden />
                </button>
              )}
              {/* grain: stills only. A mix-blend layer over a <video> pulls it
                  off the hardware overlay path, which is what made the
                  chapter videos look soft instead of HD. */}
              {!video && (
                <div
                  aria-hidden
                  className="absolute inset-0 mix-blend-overlay opacity-[0.16] pointer-events-none"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
                  }}
                />
              )}
              {/* corner caption */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                <span
                  className="text-[9px] font-medium uppercase tracking-[0.28em] text-white/85"
                  style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                >
                  {caption}
                </span>
              </div>
              {/* dissolve bottom */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/4"
                style={{ background: "linear-gradient(to top, hsl(var(--background)), transparent)" }}
              />
              {/* Subtle Kreto touch — sits inside this frame's own
                  overflow-hidden clip, so it's automatically contained on
                  every viewport rather than needing its own breakpoint
                  handling. Low opacity, no float/hover: a quiet presence
                  cue, not a second focal point competing with the chapter's
                  own image and copy. */}
              {kretoVariant && (
                <div className="pointer-events-none absolute bottom-3 right-3 opacity-40 grayscale">
                  <KretoCharacter variant={kretoVariant} size={56} floatAmplitude={0} />
                </div>
              )}
            </div>
          </motion.div>

          {/* TEXT */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="lg:col-span-5"
          >
            {/* Same eyebrow → h2 → body hierarchy as the hero and every
                other landing-* section (Search, Verified Credits, Kreto) —
                this chapter template previously built its own bespoke
                font-serif title/kicker treatment instead, the one real
                typeface break from the hero's Satoshi/Inter system. The
                chapter index ("II.") folds into the eyebrow line itself
                rather than sitting apart in a different font, with the
                same breathing accent dot AuthBrandingPanel's eyebrow pill
                uses — one small "AI-aware" presence signal, reused rather
                than invented per-section. */}
            {/* No inline color on the eyebrow: .landing-eyebrow's own
                neutral default (index.css) paints it -- the gradient is
                reserved for titles (h2 below), eyebrows stay neutral. */}
            <div className="flex items-center gap-2 mb-6">
              <span className="h-1.5 w-1.5 rounded-full ai-ambient-breathe" style={{ backgroundColor: accent }} />
              <span className="landing-eyebrow">
                {index}. {kicker}
              </span>
            </div>

            {/* Two-line title contract: line 1 plain theme-aware text,
                line 2 the accent gradient. No trailing period anywhere --
                the dot was removed landing-wide, so the old conditional
                "." sibling is gone for good. */}
            <h2 className={`landing-h2 landing-glow${gradientTitle ? " k-gradient-title" : ""}`}>
              {title}
            </h2>

            <p className="landing-sub mt-7 max-w-md">
              {body}
            </p>

            {concepts && concepts.length > 0 && (
              <div className="mt-7 grid grid-cols-2 gap-3 max-w-md">
                {concepts.map((c) => (
                  <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                    {/* Neutral label — the gradient is reserved for titles
                        only (same rule as the eyebrow above). */}
                    <p
                      className="w-fit text-[10px] font-bold uppercase tracking-[0.18em] mb-1 text-foreground"
                      style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                    >
                      {c.label}
                    </p>
                    <p className="text-xs leading-snug text-white/55" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {closingLine && (
              <p
                className="mt-6 text-sm font-semibold italic text-foreground/80"
                style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
              >
                {closingLine}
              </p>
            )}

            <div className="mt-9 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
              <GlassCta
                className="h-12 w-full py-0"
                to={`${href}${href.includes("?") ? "&" : "?"}tab=signup&src=${sectionId}`}
                onClick={() =>
                  trackLandingCtaClick({
                    ctaId: `${kicker.toLowerCase()}_chapter_cta`,
                    section: sectionId,
                    label: ctaLabel ?? `Enter ${kicker}`,
                    destinationType: "auth",
                  })
                }
              >
                {ctaLabel ?? `Enter ${kicker}`}
              </GlassCta>

              {discreetTutorial && tutorialSteps && tutorialSteps.length > 0 && (
                <KretopiaFeatureTutorial steps={tutorialSteps} featureName={kicker} />
              )}
            </div>
          </motion.div>
        </div>

        {/* Interactive tutorial — full-width panel, immediately follows its
            feature. Skipped when discreetTutorial is set: that chapter's
            tutorial lives behind the fingerprint trigger next to the CTA
            instead (see above), not as an always-visible panel here. */}
        {!discreetTutorial && tutorialSteps && tutorialSteps.length > 0 && tutorialVisual && (
          <FeatureTutorialPanel
            steps={tutorialSteps}
            label={`${kicker} tutorial`}
            visual={tutorialVisual}
            reverse={reverse}
          />
        )}
      </div>
    </section>
  );
};

export default ChapterSection;
