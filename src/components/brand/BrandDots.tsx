/**
 * BrandDots — the three Kretopia signal dots (pink · amber · teal).
 *
 * Use as:
 *   <BrandDots />                                  // static brand mark
 *   <BrandLoader label="Loading your Passport…" /> // full-bleed loading state
 *
 * The dots are a static brand mark only. Every loading / pending state in
 * the product uses the Kretopia loader (the K-mark in a rotating brand ring,
 * see KretopiaLoader.tsx), so `animated` and BrandLoader both render that
 * instead of pulsing dots.
 */

import { cn } from "@/lib/utils";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { dot: string; gap: string; spinner: string }> = {
  xs: { dot: "h-1.5 w-1.5", gap: "gap-1", spinner: "h-4 w-4" },
  sm: { dot: "h-2 w-2", gap: "gap-1.5", spinner: "h-5 w-5" },
  md: { dot: "h-2.5 w-2.5", gap: "gap-2", spinner: "h-6 w-6" },
  lg: { dot: "h-3.5 w-3.5", gap: "gap-2.5", spinner: "h-8 w-8" },
};

interface BrandDotsProps {
  size?: Size;
  /** Loading state: renders the Kretopia loader spinner instead of the dots. */
  animated?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const BrandDots = ({
  size = "sm",
  animated = false,
  className,
  ariaLabel,
}: BrandDotsProps) => {
  const { dot, gap, spinner } = SIZE_MAP[size];

  if (animated) {
    return <KretopiaSpinner className={cn(spinner, className)} aria-label={ariaLabel ?? "Loading"} />;
  }

  return (
    <div className={cn("inline-flex items-center", gap, className)} aria-hidden>
      {/* Kretopia signature — Violet · Magenta · Amber (echoes the K-mark gradient) */}
      <span className={cn(dot, "rounded-full bg-[#9413D2]")} />
      <span className={cn(dot, "rounded-full bg-[#E0179C]")} />
      <span className={cn(dot, "rounded-full bg-[#FEA61A]")} />
    </div>
  );
};

interface BrandLoaderProps {
  label?: string;
  size?: Size;
  fullscreen?: boolean;
  className?: string;
}

const LOADER_SIZE = { xs: "sm", sm: "sm", md: "lg", lg: "lg" } as const;

/**
 * BrandLoader — the loading fallback used by routes and pages. Renders the
 * Kretopia loader (K-mark in the brand ring) with an optional label.
 */
export const BrandLoader = ({
  label,
  size = "md",
  fullscreen = true,
  className,
}: BrandLoaderProps) => (
  <KretopiaLoader
    size={LOADER_SIZE[size]}
    label={label}
    fullscreen={fullscreen}
    className={cn(!fullscreen && "py-12", className)}
  />
);

export default BrandDots;
