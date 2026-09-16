import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * CANONICAL CTA — single source of truth for in-app (Studio) primary CTAs.
 *
 * Live call sites today: StudioProjectsDashboard.tsx, StudioCreateHero.tsx.
 * (The doc comment here used to point at
 * src/components/landing/BottomCTASection.tsx as the reference
 * implementation -- that file is dead code, never rendered by any route,
 * so it was never actually wired to this. The guest Landing page's own
 * primary CTAs use the separate .btn-landing-primary gradient system
 * instead, see src/index.css.)
 *
 * NOT for: navbar buttons, filters, icon-only controls, destructive
 * actions, status controls. Those keep their own affordances.
 */
export const CTA_BUTTON_CLASS =
  "cta-solid w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold group shadow-md";

export type CtaButtonProps = React.ComponentProps<typeof Button>;

export const CtaButton = React.forwardRef<HTMLButtonElement, CtaButtonProps>(
  ({ className, size = "lg", ...props }, ref) => (
    <Button ref={ref} size={size} className={cn(CTA_BUTTON_CLASS, className)} {...props} />
  ),
);
CtaButton.displayName = "CtaButton";
