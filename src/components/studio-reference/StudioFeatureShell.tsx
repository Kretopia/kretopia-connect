import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StudioFeatureShellProps {
  children: ReactNode;
  className?: string;
  /** Render as `<main>` for the page's primary landmark, or `<div>` (default) when
   * the page already has its own `<main>` elsewhere. */
  as?: ElementType;
}

/**
 * Studio's exact body container, extracted from src/pages/WorkHome.tsx
 * (CreatorWorkHome, the real /desk render path) rather than invented:
 * max-w-6xl mx-auto px-4 pt-4, asymmetric mobile bottom-nav clearance
 * collapsing at md:, space-y-5 rhythm between sections. Sits below a
 * full-bleed FeaturePageHeader/EditorialPageHero, never wraps it.
 *
 * Deliberately does not use Tailwind's `container` utility (theme.container
 * in tailwind.config.ts) -- that's a distinct, unrelated construct (its own
 * 2rem padding, unbounded width until the 2xl breakpoint) that several
 * Studio-reference surfaces were incorrectly stacking with an explicit
 * max-w-*, double-applying horizontal padding. See
 * STUDIO_CONTAINER_ALIGNMENT_REPORT.md.
 */
export function StudioFeatureShell({ children, className, as: Component = "div" }: StudioFeatureShellProps) {
  return (
    <Component className={cn("max-w-6xl mx-auto px-4 pt-4 pb-36 md:pb-12 space-y-5", className)}>
      {children}
    </Component>
  );
}
