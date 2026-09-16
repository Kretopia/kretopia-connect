import * as React from "react";
import { cn } from "@/lib/utils";
import { GlassSurface, type GlassSurfaceProps } from "./GlassSurface";

export interface GlassPanelProps extends GlassSurfaceProps {
  /** Compact = tighter padding for inline banners/tips; default = card-style padding. */
  density?: "default" | "compact";
}

/**
 * Content panel built on GlassSurface — the everyday "card" replacement:
 * empty states, tips, loading placeholders, section banners.
 */
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, density = "default", ...props }, ref) => (
    <GlassSurface
      ref={ref}
      className={cn(density === "compact" ? "p-3" : "p-5", className)}
      {...props}
    />
  ),
);
GlassPanel.displayName = "GlassPanel";

export default GlassPanel;
