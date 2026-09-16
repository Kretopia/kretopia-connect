import * as React from "react";
import { cn } from "@/lib/utils";

export type GlassNavbarProps = React.HTMLAttributes<HTMLElement>;

/**
 * Sticky top-nav shell with the Liquid Glass treatment — translucent,
 * blurred, hairline bottom border. Falls back to a solid dark bar
 * automatically (see .glass-surface-elevated's @supports fallback).
 */
export const GlassNavbar = React.forwardRef<HTMLElement, GlassNavbarProps>(
  ({ className, children, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-40 w-full glass-surface-elevated rounded-none border-x-0 border-t-0 safe-top",
        className,
      )}
      {...props}
    >
      {children}
    </header>
  ),
);
GlassNavbar.displayName = "GlassNavbar";

export default GlassNavbar;
