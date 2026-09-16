import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Every variant below shares one design language -- the glass card +
// scintillating pink-border-on-hover system defined as .btn-glass (+
// accent modifiers) in src/index.css, modeled directly on
// VisualCardShell (the landing page's "Search preview / Illustrative —
// not live data" card). Text is forced white by that CSS regardless of
// which text-* utility (if any) a variant string still carries below.
// Modifiers exist so variants stay distinguishable from each other at
// rest (pink-tinted vs neutral vs near-invisible vs red) while every one
// of them gets the same hover signature.
const HERO_LIME_CLASSES =
  "btn-glass btn-glass-primary btn-glass-hero font-black uppercase tracking-wider";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-all duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "btn-glass btn-glass-primary",
        destructive: "btn-glass btn-glass-danger",
        outline: "btn-glass btn-glass-outline",
        secondary: "btn-glass btn-glass-neutral",
        ghost: "btn-glass btn-glass-ghost font-medium",
        // Link stays a plain inline text trigger, not a boxed surface --
        // a border doesn't make sense on it. White at rest, pink on hover
        // (text + underline) is the closest honest analog to the
        // scintillating-border signature for something that isn't a box.
        link: "text-white underline-offset-4 hover:underline hover:text-[hsl(var(--energy))] transition-colors",
        gradient: "btn-glass btn-glass-primary font-bold",
        // Hero / Lime — loudest CTA. Same family, extra emphasis via
        // btn-glass-hero (stronger tint/border than plain primary) plus
        // the bold/uppercase treatment that already set it apart. Kept as
        // two variant names for call-site readability; shared string so
        // they can't drift apart.
        hero: HERO_LIME_CLASSES,
        lime: HERO_LIME_CLASSES,
        glow: "btn-glass btn-glass-primary animate-glow",
        // Liquid Glass trigger surface (dropdowns/menus) — keeps its own
        // .glass-surface mechanism (used elsewhere beyond Button) rather
        // than switching to .btn-glass, but text is forced white and the
        // hover/open accent is the same signature pink as every other
        // variant now, not a theme-dependent token.
        glass: "glass-surface text-white hover:border-[hsl(var(--energy)/0.5)] hover:text-white data-[state=open]:border-[hsl(var(--energy)/0.6)] data-[state=open]:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8",
        xl: "h-14 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
