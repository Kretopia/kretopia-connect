import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use the more opaque, more blurred "elevated" treatment (drawers, modals, popovers) instead of the base surface (cards, panels). */
  elevated?: boolean;
  asChild?: boolean;
}

/**
 * Foundational Liquid Glass primitive. Translucent surface, soft blur,
 * hairline border, faint inner highlight, soft shadow — degrades to a
 * solid dark fill automatically when backdrop-filter isn't supported
 * (see .glass-surface / .glass-surface-elevated in index.css).
 */
export const GlassSurface = React.forwardRef<HTMLDivElement, GlassSurfaceProps>(
  ({ className, elevated = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl",
        elevated ? "glass-surface-elevated" : "glass-surface",
        className,
      )}
      {...props}
    />
  ),
);
GlassSurface.displayName = "GlassSurface";

export default GlassSurface;
