/**
 * BrandDots — the three Kretopia signal dots (pink · amber · teal).
 *
 * Use as:
 *   <BrandDots />                                  // static brand mark
 *   <BrandDots animated />                         // rhythmic loading pulse
 *   <BrandLoader label="Loading your Passport…" /> // full-bleed loading state
 *
 * Reserve `animated` for loading / pending states across the platform.
 * Do NOT use it as a permanent decoration inside Studios or Soundstages —
 * those rooms have their own presence + typing indicators.
 */

import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { dot: string; gap: string }> = {
  xs: { dot: "h-1.5 w-1.5", gap: "gap-1" },
  sm: { dot: "h-2 w-2", gap: "gap-1.5" },
  md: { dot: "h-2.5 w-2.5", gap: "gap-2" },
  lg: { dot: "h-3.5 w-3.5", gap: "gap-2.5" },
};

interface BrandDotsProps {
  size?: Size;
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
  const { dot, gap } = SIZE_MAP[size];

  return (
    <div
      className={cn("inline-flex items-center", gap, className)}
      role={animated ? "status" : undefined}
      aria-label={animated ? ariaLabel ?? "Loading" : undefined}
      aria-hidden={animated ? undefined : true}
    >
      {/* Kretopia signature — Violet · Magenta · Amber (echoes the K-mark gradient) */}
      <span
        className={cn(dot, "rounded-full bg-[#9413D2]", animated && "animate-brand-dot")}
        style={animated ? { animationDelay: "0ms" } : undefined}
      />
      <span
        className={cn(dot, "rounded-full bg-[#E0179C]", animated && "animate-brand-dot")}
        style={animated ? { animationDelay: "150ms" } : undefined}
      />
      <span
        className={cn(dot, "rounded-full bg-[#FEA61A]", animated && "animate-brand-dot")}
        style={animated ? { animationDelay: "300ms" } : undefined}
      />
    </div>
  );
};

interface BrandLoaderProps {
  label?: string;
  size?: Size;
  fullscreen?: boolean;
  className?: string;
}

/**
 * BrandLoader — drop-in replacement for spinner-based loading fallbacks.
 * Renders the animated BrandDots above an optional label.
 */
export const BrandLoader = ({
  label,
  size = "md",
  fullscreen = true,
  className,
}: BrandLoaderProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3",
      fullscreen ? "min-h-screen w-full" : "py-12",
      className,
    )}
  >
    <BrandDots animated size={size} ariaLabel={label ?? "Loading"} />
    {label && <p className="text-xs text-muted-foreground font-medium">{label}</p>}
  </div>
);

export default BrandDots;
