import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

/**
 * Glass-family input — deliberately near-opaque, not translucent like
 * GlassSurface/GlassPanel. Typed content needs high contrast, so this
 * only borrows the family's visual language (soft border, subtle blur,
 * rounded corners, accent focus ring) without the readability cost of
 * real translucency behind text entry.
 */
export const GlassInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      className={cn(
        "bg-card/95 backdrop-blur-md border-white/10 rounded-xl",
        "focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))] focus-visible:ring-offset-0 focus-visible:border-[hsl(var(--color-accent))]",
        className,
      )}
      {...props}
    />
  ),
);
GlassInput.displayName = "GlassInput";

export default GlassInput;
