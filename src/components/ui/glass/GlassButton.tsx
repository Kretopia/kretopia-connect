import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

export type GlassButtonProps = Omit<ButtonProps, "variant">;

/**
 * Convenience wrapper over Button's "glass" variant — translucent
 * surface, hairline border, accent-colored text/border on hover and
 * when open (for popover/menu triggers). Keeps Button as the single
 * source of truth for focus-visible, disabled, and size styles.
 */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (props, ref) => <Button ref={ref} variant="glass" {...props} />,
);
GlassButton.displayName = "GlassButton";

export default GlassButton;
