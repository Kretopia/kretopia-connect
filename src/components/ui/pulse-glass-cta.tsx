import { forwardRef } from "react";
import { GlassCtaButton, type GlassCtaButtonProps } from "@/components/ui/glass-cta";
import { cn } from "@/lib/utils";

export interface PulseGlassCtaButtonProps extends GlassCtaButtonProps {
  /** Work this button started is running: the rings speed up and a beam runs along its foot. */
  busy?: boolean;
  /** Classes for the wrapper that holds the rings (its width decides theirs). */
  wrapperClassName?: string;
}

/**
 * The primary glass button with a pulse that draws the eye to a surface's one main action: two rings ping out
 * behind it and a sheen sweeps across it. Scout's "Scan now" and Studio's "Open a New Room" are this button, so
 * the effect is one definition (the .k-pulse-cta rules in index.css) instead of a copy per page.
 *
 * All of it is decoration (aria-hidden, pointer-events none) that stops under prefers-reduced-motion, leaving a
 * still glass pill. The label, and aria-busy where the caller sets it, stay the real signal.
 */
export const PulseGlassCtaButton = forwardRef<HTMLButtonElement, PulseGlassCtaButtonProps>(
  ({ busy = false, wrapperClassName, className, children, ...buttonProps }, ref) => (
    <div data-busy={busy} className={cn("k-pulse-cta relative flex", wrapperClassName)}>
      <span aria-hidden className="k-pulse-cta-ring" />
      <span aria-hidden className="k-pulse-cta-ring k-pulse-cta-ring-late" />
      <GlassCtaButton ref={ref} className={cn("relative z-10 overflow-hidden", className)} {...buttonProps}>
        <span aria-hidden className="k-pulse-cta-sheen" />
        {children}
        <span aria-hidden className="k-pulse-cta-beam" />
      </GlassCtaButton>
    </div>
  ),
);
PulseGlassCtaButton.displayName = "PulseGlassCtaButton";

export default PulseGlassCtaButton;
