import { forwardRef, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * GlassCta — the marketing-surface call-to-action: pink-tinted frosted glass
 * (btn-glass-primary), pill shape, semibold label, trailing ↗ that nudges on
 * hover. It is exactly the landing page's "Explore Verified Credits" button,
 * extracted so every landing CTA is that button by construction instead of
 * by copy-paste (there were already three hand-copied versions drifting
 * apart in padding, icon and hover behavior).
 *
 * Not the same thing as CtaButton (./cta-button.tsx): that one is the solid
 * primary fill for in-app (Studio/Today) actions and renders a <button>;
 * this one is a router <Link> with the glass treatment, for public pages.
 *
 * Sizes only scale the same design: "md" is the reference; "sm" is the
 * header-density version for the navbar; "lg" sits next to the hero's
 * (deliberately different) gradient-border secondary so the pair stays level.
 */
const SIZE = {
  sm: "px-5 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-7 py-3.5 text-base",
} as const;

export interface GlassCtaProps extends Omit<LinkProps, "className" | "children"> {
  children: ReactNode;
  size?: keyof typeof SIZE;
  className?: string;
  /** Trailing icon. Defaults to the reference ↗; pass null for none. */
  icon?: ReactNode | null;
}

export const GlassCta = forwardRef<HTMLAnchorElement, GlassCtaProps>(
  ({ children, size = "md", className, icon, ...linkProps }, ref) => (
    <Button
      asChild
      className={cn("glass-cta group h-auto w-fit rounded-full font-semibold", SIZE[size], className)}
      style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
    >
      <Link ref={ref} {...linkProps}>
        {children}
        {icon === undefined ? (
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        ) : (
          icon
        )}
      </Link>
    </Button>
  ),
);
GlassCta.displayName = "GlassCta";

export default GlassCta;
