/**
 * Kretopia shared typography components — Section 3 of the Global
 * Typography, UX/UI and AI-Powered Motion Overhaul.
 *
 * These are NOT a replacement for CinematicHeaderPlate (the aurora/grain
 * cinematic hero used by FeaturePageHeader/EditorialPageHero) — that
 * remains the system for pages that want the full landing-style treatment.
 * These three cover what that system doesn't: a plain, consistent page
 * title for pages that don't need a cinematic hero, and the two smaller
 * hierarchy levels (section labels, card titles) that were previously
 * hand-rolled independently in 66+ files with inconsistent tags (`<p>`,
 * `<span>`, `<h3>`, `<label>` all used for the same visual role — see
 * GLOBAL_UX_UI_INVENTORY.md) and inconsistent sizing.
 *
 * All three render a real semantic heading by default (never a styled
 * <span>/<p> pretending to be one) and inherit the one brand font via the
 * global --font-family-brand cascade — no font-family declared here.
 */
import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Standard entrance: matches CinematicHeaderPlate's own reveal (see
 *  MOTION_SYSTEM.md's "standard" token) so a PageTitle and a cinematic
 *  hero title never feel like two different animation systems. */
const STANDARD_EASE = [0.2, 0.65, 0.3, 0.95] as const;

interface PageTitleProps {
  /** The page's one <h1>. Keep it short — this is not the cinematic hero. */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned slot for a primary action button, filter, etc. */
  action?: ReactNode;
  className?: string;
  /** Skip the mount reveal — use for pages where instant render matters more
   *  (e.g. inside an already-animated parent). */
  animated?: boolean;
}

/**
 * Plain page-level title for pages that don't use the cinematic hero
 * (FeaturePageHeader/EditorialPageHero). One <h1>, consistent size, an
 * optional subtitle and an optional action slot — nothing decorative.
 */
export function PageTitle({ title, subtitle, action, className, animated = true }: PageTitleProps) {
  const reducedMotion = useReducedMotion();
  const Wrapper = animated ? motion.div : "div";
  const motionProps = animated
    ? {
        initial: reducedMotion ? false : { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: STANDARD_EASE },
      }
    : {};

  return (
    <Wrapper
      className={cn("flex items-start justify-between gap-4 flex-wrap", className)}
      {...motionProps}
    >
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Wrapper>
  );
}

interface SectionHeadingProps {
  children: ReactNode;
  subtitle?: ReactNode;
  /** Heading level — pick based on real document structure, not visual
   *  preference. Default h2 (a page-level section, one below PageTitle's
   *  h1). Use h3 for a section nested inside another section. */
  as?: "h2" | "h3" | "h4";
  /** Small leading icon, e.g. a lucide-react icon — a real, recurring
   *  variant (Hire Talent's "Your Company"/"Opportunity" sections). */
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * The small uppercase section-label pattern already used ~66 times across
 * the codebase (e.g. Hire Talent's "YOUR COMPANY", Passport's "KRETO
 * ACTION CENTER", "TRUST & OPPORTUNITY"), formalized as one real, always-
 * semantic heading instead of an ad hoc <p>/<span>/<label> per file.
 * Visual style matches the most common existing variant so this is a
 * drop-in replacement, not a new visual language.
 */
export function SectionHeading({ children, subtitle, as: Tag = "h2", icon, action, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className={cn("flex items-center", icon ? "gap-2" : "")}>
          {icon}
          <Tag className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {children}
          </Tag>
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground/70">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface SmartCardTitleProps {
  children: ReactNode;
  /** e.g. a role, category, or status shown under the title. */
  meta?: ReactNode;
  as?: "h3" | "h4" | "h5";
  className?: string;
}

/**
 * Card/list-item title — one level below SectionHeading. For individual
 * items inside a list or grid (a credit card, a stage, an opportunity
 * row), not for page or section titles.
 */
export function SmartCardTitle({ children, meta, as: Tag = "h3", className }: SmartCardTitleProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <Tag className="text-sm font-semibold text-foreground truncate">{children}</Tag>
      {meta && <p className="text-xs text-muted-foreground truncate">{meta}</p>}
    </div>
  );
}
