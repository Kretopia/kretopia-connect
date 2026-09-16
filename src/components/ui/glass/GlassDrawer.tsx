import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetTrigger,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
} from "@/components/ui/sheet";

const sideClasses: Record<"top" | "bottom" | "left" | "right", string> = {
  top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top rounded-b-2xl rounded-t-none",
  bottom:
    "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-2xl rounded-b-none",
  left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm rounded-r-2xl rounded-l-none",
  right:
    "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm rounded-l-2xl rounded-r-none",
};

interface GlassDrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: "top" | "bottom" | "left" | "right";
}

/** Sheet/drawer content with the Liquid Glass elevated treatment. */
export const GlassDrawerContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  GlassDrawerContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className={cn(
        "fixed z-50 gap-4 glass-surface-elevated p-6 transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
        sideClasses[side],
        className,
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))] disabled:pointer-events-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
GlassDrawerContent.displayName = "GlassDrawerContent";

/** Root + trigger re-exported for a self-contained import from one place. */
export const GlassDrawer = Sheet;
export {
  SheetTrigger as GlassDrawerTrigger,
  SheetClose as GlassDrawerClose,
  SheetHeader as GlassDrawerHeader,
  SheetFooter as GlassDrawerFooter,
  SheetTitle as GlassDrawerTitle,
  SheetDescription as GlassDrawerDescription,
};

export default GlassDrawer;
