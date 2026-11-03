import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { readReturnTo, restoreState } from "@/lib/passportReturn";
import { cn } from "@/lib/utils";

/**
 * The way back from a detail view opened out of a Passport: a real link to the Passport (its tab and filters live in its address), which
 * restores how far down the page the person was. A link, not a history step, so it is focusable, announced as "Back to Passport", and
 * works when the view was reached in a way that left no useful history. It renders nothing when the view was not opened from a Passport.
 */
export function BackToPassport({ className }: { className?: string }) {
  const location = useLocation();
  const target = readReturnTo(location.state);
  if (!target) return null;
  return (
    <nav aria-label="Back" className={cn("mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6", className)}>
      <Link
        to={target.path}
        state={restoreState(target.scrollTop)}
        aria-label={`Back to ${target.label}`}
        data-testid="back-to-passport"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        <span>{target.label}</span>
      </Link>
    </nav>
  );
}

export default BackToPassport;
