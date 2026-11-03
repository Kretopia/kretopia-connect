import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogIn, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { signInHref } from "@/lib/entryChoice";
import { isInAppPath } from "@/lib/inAppPath";

interface GuestEntryChoiceProps {
  /** What the person was invited to ("You're invited to a live call"). */
  title: string;
  /** The specific thing, when known (a meeting's title, a project's name). */
  context?: ReactNode;
  /** The in-app address to come back to after signing in. */
  signInTo: string;
  /** Where "Sign in" goes when it is not the sign-in page with a return address (an in-app address). */
  signInUrl?: string;
  /** What each path means for this entry, in one short line each. */
  signInHint: string;
  guestHint: string;
  onContinueAsGuest: () => void;
}

/**
 * The first screen of a join link or an invitation for someone who is not signed in: two options, side by side, the same size, weight and
 * type. Neither is pre-selected or focused, neither carries a warning or a nudge, and the guest path is a full path, not a lesser one.
 * It needs no session: it only links to the sign-in page and calls back when the guest option is taken.
 */
export function GuestEntryChoice({ title, context, signInTo, signInUrl, signInHint, guestHint, onContinueAsGuest }: GuestEntryChoiceProps) {
  // One class string for both, so the two can never drift apart.
  const optionClass =
    "group flex min-h-[104px] w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left text-foreground transition-colors " +
    "hover:border-foreground/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const chipClass = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground";

  return (
    <main className="k-call-min-vh flex flex-col items-center justify-center bg-background px-4 py-10 text-foreground" data-testid="guest-entry-choice">
      <section aria-labelledby="entry-choice-title" className="w-full max-w-xl space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo size="sm" />
          <div className="space-y-1.5">
            <h1 id="entry-choice-title" className="text-2xl font-bold tracking-tight">
              {title}
            </h1>
            {context ? <p className="text-sm text-muted-foreground">{context}</p> : null}
          </div>
        </div>

        <div role="group" aria-labelledby="entry-choice-title" className="grid gap-3 sm:grid-cols-2">
          <Link to={isInAppPath(signInUrl) ? signInUrl : signInHref(signInTo)} className={optionClass} data-testid="entry-sign-in">
            <span className={chipClass} aria-hidden>
              <LogIn className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold">Sign in</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{signInHint}</span>
            </span>
          </Link>

          <button type="button" onClick={onContinueAsGuest} className={optionClass} data-testid="entry-guest">
            <span className={chipClass} aria-hidden>
              <UserRound className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold">Continue as guest</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{guestHint}</span>
            </span>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">Your choice is kept for this tab only.</p>
      </section>
    </main>
  );
}

export default GuestEntryChoice;
