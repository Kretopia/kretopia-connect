/**
 * ChapterSection — full-bleed editorial "movie chapter" for each pillar.
 * One image. One sentence. One accent. Restrained motion.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { ComponentType } from "react";
import type { TutorialStep } from "./FeatureTutorial";
import { FeatureTutorialPanel } from "./FeatureTutorialPanel";
import { KretopiaFeatureTutorial } from "./KretopiaFeatureTutorial";
import { Button } from "@/components/ui/button";
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
  accent: string;       // hex
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
  index, kicker, title, body, caption, image, accent, href, reverse, id, tutorialSteps, tutorialVisual,
  ctaLabel, concepts, closingLine, discreetTutorial, kretoVariant,
}: ChapterProps) => {
  const reducedMotion = useReducedMotion();
  const sectionId = (id ?? kicker.toLowerCase()) as LandingSectionId;
  return (
    <section
      id={id}
      className="relative overflow-hidden border-t border-white/[0.05]"
      style={{ backgroundColor: "#05070D" }}
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
            <div className="relative aspect-[4/5] sm:aspect-[5/6] lg:aspect-[4/5] overflow-hidden">
              <img
                src={image}
                alt={caption}
                width={1536}
                height={1920}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* grain */}
              <div
                aria-hidden
                className="absolute inset-0 mix-blend-overlay opacity-[0.16] pointer-events-none"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
                }}
              />
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
                style={{ background: "linear-gradient(to top, #05070D, transparent)" }}
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
            <div className="flex items-center gap-2 mb-6">
              <span className="h-1.5 w-1.5 rounded-full ai-ambient-breathe" style={{ backgroundColor: accent }} />
              <span className="landing-eyebrow" style={{ color: accent }}>
                {index}. {kicker}
              </span>
            </div>

            <h2 className="landing-h2 landing-glow">
              {title}
              <span className="pink-glow-breathe" style={{ color: accent }}>.</span>
            </h2>

            <p className="landing-sub mt-7 max-w-md">
              {body}
            </p>

            {concepts && concepts.length > 0 && (
              <div className="mt-7 grid grid-cols-2 gap-3 max-w-md">
                {concepts.map((c) => (
                  <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1"
                      style={{ color: accent, fontFamily: "'Satoshi', 'Inter', sans-serif" }}
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
                className="mt-6 text-sm font-semibold italic"
                style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'Satoshi', 'Inter', sans-serif" }}
              >
                {closingLine}
              </p>
            )}

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="group h-auto w-fit rounded-full px-6 py-3 text-sm font-semibold"
                style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
              >
                <Link
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
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </Link>
              </Button>

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
