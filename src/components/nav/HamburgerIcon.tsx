import { cn } from "@/lib/utils";
import { NAV_ICON, NAV_ICON_STROKE } from "@/components/nav/navIcon";

interface HamburgerIconProps {
  /** The menu is open: the bars are an X. This is state, so it shows for a touch or a keyboard user exactly as it does for a mouse. */
  open?: boolean;
  className?: string;
}

/**
 * The menu button's mark: three bars of one length, the same stroke and the same part of the box as the icons beside it (navIcon.ts).
 *
 * They become an X when the menu is open, and, for a fine pointer only, while the pointer is over the button (the rules are in index.css
 * under HAMBURGER). Nothing depends on hover: a phone never hovers, and the open state carries the same X. Keyboard focus does not draw
 * the X, since focus is not "open"; the button's own focus ring says where focus is. With reduced motion the bars switch without moving.
 */
export function HamburgerIcon({ open = false, className }: HamburgerIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={NAV_ICON_STROKE}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      data-open={open ? "true" : undefined}
      className={cn("k-burger", NAV_ICON, className)}
    >
      <line className="k-burger-bar k-burger-top" x1="2.5" y1="6.5" x2="21.5" y2="6.5" />
      <line className="k-burger-bar k-burger-mid" x1="2.5" y1="12" x2="21.5" y2="12" />
      <line className="k-burger-bar k-burger-bot" x1="2.5" y1="17.5" x2="21.5" y2="17.5" />
    </svg>
  );
}

export default HamburgerIcon;
