import type { ReactNode } from "react";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { FeatureAITutorial } from "./FeatureAITutorial";
import { CinematicHeaderPlate } from "./CinematicHeaderPlate";
import { KGradientDefs } from "@/components/brand/KGradientDefs";

interface FeaturePageHeaderProps {
  /** e.g. "Live gigs" — short, uppercase, pill-badged */
  eyebrow: string;
  /** White first line — keep it short (2-4 words). */
  title: ReactNode;
  /** Kretopia-gradient second line (any trailing "." in the string is
   *  swept into the gradient too, unlike the landing chapters' own
   *  pattern of a separate white period -- accentTitle is a caller-owned
   *  string/ReactNode here, not something this template can safely split). */
  accentTitle?: ReactNode;
  subtitle: string;
  /** Optional segmented tab toggle, rendered below the title block. */
  tabs?: ReactNode;
  /** Feature key + tutorial steps -- omit to render the header with no tutorial trigger. */
  tutorial?: { featureKey: string; label: string; steps: TutorialStep[] };
  /** Prefer one line on wider screens; defaults to wrapping for long titles. */
  oneLine?: boolean;
  /** Tighter top padding -- see CinematicHeaderPlate's own doc. Default false. */
  compact?: boolean;
  /** Allow interactive footer content such as search results to extend over the page below. */
  allowOverflow?: boolean;
}

/**
 * Shared cinematic page header, used by ~17 feature pages (Match, Scout,
 * Studio, Passport, Circle, ThrivePay, Admin...). Used to force the literal
 * `dark` class on itself -- every one of those headers rendered dark no
 * matter what the user picked in Settings, which is the "my headers are
 * still dark" bug: `dark` isn't just a hardcoded background, it overrides
 * every --background/--foreground/etc. token for this whole subtree
 * regardless of the real theme. Now resolves --background itself instead,
 * so it follows Dark/Light like everything else.
 */
export function FeaturePageHeader({ eyebrow, title, accentTitle, subtitle, tabs, tutorial, oneLine = false, compact = false, allowOverflow = false }: FeaturePageHeaderProps) {
  return (
    <div
      className={`feature-reference-header relative pt-[env(safe-area-inset-top)] ${allowOverflow ? "overflow-visible z-[100]" : "overflow-hidden"}`}
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      <KGradientDefs />
      {/* aurora — neutral white glow (no purple): the gradient is reserved
          for title text, so the backdrop stays achromatic. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 ai-ambient-breathe"
        style={{ background: "radial-gradient(60% 55% at 50% 0%, hsl(var(--foreground) / 0.07), transparent 62%)" }}
      />
      {/* quadrillé grid texture — restrained graph-paper lines, faded via mask */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-quadrille" />
      {/* grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.13]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <CinematicHeaderPlate
        eyebrow={eyebrow}
        title={title}
        accentTitle={accentTitle}
        subtitle={subtitle}
        align="left"
        oneLine={oneLine}
        compact={compact}
        cornerSlot={
          // The tutorial trigger floats in the header's corner instead of
          // sitting between the subtitle and the first card — no sandwich.
          tutorial && (
            <FeatureAITutorial
              featureKey={tutorial.featureKey}
              label={tutorial.label}
              steps={tutorial.steps}
              variant="floating"
              className="absolute right-4 top-4 z-10"
            />
          )
        }
        footer={tabs && <div className="mt-6">{tabs}</div>}
      />
    </div>
  );
}

export default FeaturePageHeader;
