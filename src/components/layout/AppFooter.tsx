import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";
import type { AppFooterVariant } from "@/lib/appChrome";
import { cn } from "@/lib/utils";

interface AppFooterProps {
  variant: AppFooterVariant;
  /** Padding that keeps the footer's last line clear of whatever is fixed to the bottom of a phone screen (see footerBottomReserve). */
  reserve?: string;
}

/**
 * The one footer of the product: the Landing page's own (EditorialFooter), drawn once by the app layout under the pages that appFooter
 * names. `landing-theme` is what makes that footer follow Daylight and Midnight like the rest of the page (it is written in white for the
 * dark Landing); it is the same wrapper the Landing, About and Pricing pages use.
 */
export function AppFooter({ variant, reserve }: AppFooterProps) {
  return (
    <div data-app-footer className={cn("landing-theme", reserve)}>
      <EditorialFooter variant={variant} />
    </div>
  );
}

export default AppFooter;
