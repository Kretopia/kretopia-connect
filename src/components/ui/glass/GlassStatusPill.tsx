import * as React from "react";
import { cn } from "@/lib/utils";

export type GlassStatusPillVariant = "neutral" | "active" | "success" | "warning" | "error";

const VARIANT_CLASSES: Record<GlassStatusPillVariant, string> = {
  neutral: "text-muted-foreground",
  active: "text-[hsl(var(--color-accent))]",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
};

const DOT_CLASSES: Record<GlassStatusPillVariant, string> = {
  neutral: "bg-muted-foreground",
  active: "bg-[hsl(var(--color-accent))]",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-destructive",
};

export interface GlassStatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: GlassStatusPillVariant;
  /** Pulses the dot — use sparingly, for genuinely live/active state only. */
  live?: boolean;
}

/**
 * Small glass-surface status pill — a dot + label. `active` uses the
 * single accent; success/warning/error stay semantic per the design
 * system reset (functional meaning, not decoration).
 */
export const GlassStatusPill = React.forwardRef<HTMLSpanElement, GlassStatusPillProps>(
  ({ className, variant = "neutral", live = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full glass-surface px-2.5 py-1 text-[11px] font-semibold",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_CLASSES[variant], live && "motion-safe:animate-pulse")} aria-hidden="true" />
      {children}
    </span>
  ),
);
GlassStatusPill.displayName = "GlassStatusPill";

export default GlassStatusPill;
