import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface EventStickyBookingBarProps {
  children: ReactNode;
  /** The signed-in bottom navigation is on screen: the bar sits just above it instead of at the screen's edge. */
  bottomNav: boolean;
}

/**
 * The booking control, kept in reach on a phone once the booking block has scrolled away. It holds the same single control the block
 * holds (the block moves it here and back, so only one exists at a time) and is not drawn from `lg`, where the block itself is sticky.
 *
 * It is drawn into the document body, like the bottom nav: inside the page it would sit in the page shell's own stacking layer, and the
 * shared footer (which follows the shell) would paint over it instead of leaving it above its reserved room.
 */
export function EventStickyBookingBar({ children, bottomNav }: EventStickyBookingBarProps) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-event-slot="sticky-booking"
      className={cn(
        // z-30: under the Kreto launcher (z-40) and the bottom nav (z-50), above the page and its footer.
        "fixed inset-x-0 z-30 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur md:px-6 lg:hidden",
        bottomNav
          // A signed-in member has the bottom nav, and the Kreto launcher floating at the right above it: the control keeps clear of both.
          ? "bottom-[calc(3.7rem+max(env(safe-area-inset-bottom,0px),10px))] pb-3 pr-[6.25rem] md:pr-[6.25rem]"
          : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

export default EventStickyBookingBar;
