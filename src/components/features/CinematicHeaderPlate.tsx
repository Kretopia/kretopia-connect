/**
 * CinematicHeaderPlate — the shared render core behind FeaturePageHeader and
 * EditorialPageHero. Both components wrap this with their own outer element
 * and backdrop layers (aurora/grid/grain) and pass through their own extras
 * (tutorial trigger, tabs, children) via `preTitle`/`footer` — but the
 * eyebrow, title, subtitle and reveal motion render from exactly one
 * place now, instead of being duplicated between the two files. See
 * TITLE_ANIMATION_AUDIT.md for why this split existed and was normalized:
 * the two components previously had identical motion timing but diverging
 * container width (1024px vs 1100px) and vertical padding.
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// The Kreto chapter uses a neutral eyebrow and a single uninterrupted
// gradient phrase. Splitting the gradient into animated word spans leaves
// transparent words when background-clip paints only the parent's text.

export interface CinematicHeaderPlateProps {
  eyebrow?: string;
  title: ReactNode;
  accentTitle?: ReactNode;
  subtitle?: string;
  /** Centre the whole block (default) or keep it left-aligned. */
  align?: "left" | "center";
  /** Prefer one line on wider screens for short titles. Long titles wrap instead of clipping. */
  oneLine?: boolean;
  /** Keep the subtitle itself on one line (auto-scaled to fit, same idea as
   *  `oneLine` for the title). Default false — most callers write a subtitle
   *  long enough that it reads better wrapped at `max-w-xl`; opt in only
   *  when the copy was written short and punchy on purpose (see About). */
  subtitleOneLine?: boolean;
  /** Centered action replacing the small eyebrow above the heading. */
  preTitle?: ReactNode;
  /** A picture under the subtitle (a Kreto scene banner), centred and capped in width. */
  art?: ReactNode;
  /** Content below the subtitle (tabs, search bar, CTA row) -- renders outside the title's own fade-up so it's immediately interactive. */
  footer?: ReactNode;
  /** Tighter top padding (pt-3/sm:pt-4 instead of pt-10/sm:pt-14) for a
   *  surface that sits directly under the sticky Navbar with no separate
   *  hero visual of its own -- Today is the first caller. Every other
   *  feature page keeps the full padding meant to give this plate its own
   *  breathing room as the page's actual opening beat. Default false. */
  compact?: boolean;
}

export function CinematicHeaderPlate({
  eyebrow, title, accentTitle, subtitle, align = "center", oneLine = false, subtitleOneLine = false, preTitle, art, footer, compact = false,
}: CinematicHeaderPlateProps) {
  const reducedMotion = useReducedMotion();
  const centered = align === "center";

  return (
    <div className={`relative container mx-auto max-w-5xl px-4 pb-8 sm:pb-12 ${compact ? "pt-3 sm:pt-4" : "pt-10 sm:pt-14"}`}>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: [0.2, 0.65, 0.3, 0.95] }}
        className={centered ? "flex flex-col items-center gap-4 text-center" : "flex flex-col gap-4"}
      >
        <div className={`flex flex-col w-full ${centered ? "items-center" : ""}`}>
          {(preTitle || eyebrow) && (
            <div className={`flex items-center mb-6 ${preTitle ? "justify-center" : centered ? "justify-center" : ""}`}>
              {preTitle ?? <span className="landing-eyebrow">{eyebrow}</span>}
            </div>
          )}
          {/* Font size is a fixed, moderate clamp regardless of `oneLine` --
              `oneLine` only toggles wrap behaviour (sm:whitespace-nowrap).
              It used to also gate this size override, so once its default
              flipped to false, every caller that didn't explicitly opt
              into oneLine silently fell through to .landing-h1's own
              clamp(1.35rem, 6vw, 4.75rem) -- the landing HERO's scale, up
              to 76px on a real desktop viewport. That's a feature-page
              header, not the hero; it keeps this smaller cap always. */}
          <h1
            className={`landing-h1 landing-glow w-full max-w-4xl text-balance break-words py-2 ${oneLine ? "sm:whitespace-nowrap" : ""}`}
            style={{
              color: "hsl(var(--foreground))",
              fontSize: "clamp(1.5rem, 3.6vw, 3rem)",
            }}
          >
            {title}
            {accentTitle && <>{" "}<span className="italic k-gradient-text">{accentTitle}</span></>}
          </h1>
          {subtitle && (
            <p
              className={`landing-sub mt-5 ${subtitleOneLine ? "whitespace-nowrap" : "max-w-xl"} ${centered ? "mx-auto" : ""}`}
              style={{
                color: "hsl(var(--muted-foreground))",
                ...(subtitleOneLine ? { fontSize: "clamp(0.6875rem, 3.1vw, 1.0625rem)" } : {}),
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {art && <div className="mt-2 w-full max-w-xl">{art}</div>}
      </motion.div>
      {footer}
    </div>
  );
}

export default CinematicHeaderPlate;
