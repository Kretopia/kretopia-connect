import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The Landing call-to-action pair, extracted so every surface that wears it
 * (Landing, and in-app cards like Today) is that button by construction
 * instead of by copy-paste.
 *
 *  - Primary   (GlassCta / GlassCtaButton): pink-tinted frosted glass
 *    (btn-glass-primary), pill shape, semibold label, trailing ↗ that nudges
 *    on hover. Exactly the landing page's "Explore Verified Credits" button.
 *  - Secondary (OutlineCta / OutlineCtaButton): the hero's "Explore
 *    Opportunities" pill, a hairline border that firms up and lifts on hover.
 *
 * `…Cta` renders a router <Link> (navigation); `…CtaButton` renders a
 * <button> (an action that happens in place). Same classes either way.
 *
 * Not the same thing as CtaButton (./cta-button.tsx): that one is the solid
 * primary fill used by Studio's own create hero.
 *
 * Sizes only scale the same design: "md" is the reference; "sm" is the
 * header-density version for the navbar; "lg" is the hero pair, level with
 * each other.
 */
const SIZE = {
  sm: "px-5 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-7 py-3.5 text-base",
} as const;

type CtaSize = keyof typeof SIZE;

const FONT = { fontFamily: "'Satoshi', 'Inter', sans-serif" } as const;

const glassClass = (size: CtaSize, className?: string) =>
  cn("glass-cta group h-auto w-fit rounded-full font-semibold", SIZE[size], className);

const outlineClass = (size: CtaSize, className?: string) =>
  cn(
    "group inline-flex items-center justify-center gap-2 rounded-full border border-border font-semibold text-foreground transition-colors duration-200 hover:-translate-y-0.5 hover:border-foreground/35",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-foreground/50",
    "disabled:pointer-events-none disabled:opacity-50",
    SIZE[size],
    className,
  );

const DefaultArrow = () => (
  <ArrowUpRight
    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
    aria-hidden
  />
);

interface CtaCommon {
  children: ReactNode;
  size?: CtaSize;
  className?: string;
}

export interface GlassCtaProps extends CtaCommon, Omit<LinkProps, "className" | "children"> {
  /** Trailing icon. Defaults to the reference ↗; pass null for none. */
  icon?: ReactNode | null;
}

export const GlassCta = forwardRef<HTMLAnchorElement, GlassCtaProps>(
  ({ children, size = "md", className, icon, ...linkProps }, ref) => (
    <Button asChild className={glassClass(size, className)} style={FONT}>
      <Link ref={ref} {...linkProps}>
        {children}
        {icon === undefined ? <DefaultArrow /> : icon}
      </Link>
    </Button>
  ),
);
GlassCta.displayName = "GlassCta";

export interface GlassCtaButtonProps extends CtaCommon, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  /** Trailing icon. Defaults to the reference ↗; pass null for none. */
  icon?: ReactNode | null;
}

export const GlassCtaButton = forwardRef<HTMLButtonElement, GlassCtaButtonProps>(
  ({ children, size = "md", className, icon, type = "button", ...buttonProps }, ref) => (
    <Button ref={ref} type={type} className={glassClass(size, className)} style={FONT} {...buttonProps}>
      {children}
      {icon === undefined ? <DefaultArrow /> : icon}
    </Button>
  ),
);
GlassCtaButton.displayName = "GlassCtaButton";

export interface OutlineCtaProps extends CtaCommon, Omit<LinkProps, "className" | "children"> {
  icon?: ReactNode;
}

export const OutlineCta = forwardRef<HTMLAnchorElement, OutlineCtaProps>(
  ({ children, size = "md", className, icon, ...linkProps }, ref) => (
    <Link ref={ref} className={outlineClass(size, className)} style={FONT} {...linkProps}>
      {children}
      {icon}
    </Link>
  ),
);
OutlineCta.displayName = "OutlineCta";

export interface OutlineCtaButtonProps extends CtaCommon, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  icon?: ReactNode;
}

export const OutlineCtaButton = forwardRef<HTMLButtonElement, OutlineCtaButtonProps>(
  ({ children, size = "md", className, icon, type = "button", ...buttonProps }, ref) => (
    <button ref={ref} type={type} className={outlineClass(size, className)} style={FONT} {...buttonProps}>
      {children}
      {icon}
    </button>
  ),
);
OutlineCtaButton.displayName = "OutlineCtaButton";

export default GlassCta;
