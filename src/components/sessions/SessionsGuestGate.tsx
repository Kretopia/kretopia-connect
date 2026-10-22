import { Calendar } from "lucide-react";

import { GlassCta, OutlineCta } from "@/components/ui/glass-cta";

/**
 * What a signed-out visitor sees in Discover's Events lane: the lane reads sessions near a person and the ones they
 * joined or host, so without an account there is nothing of theirs to list. Public events stay one tap away.
 */
export function SessionsGuestGate() {
  const next = encodeURIComponent("/discover?tab=events");
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/50 text-foreground">
        <Calendar className="h-5 w-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Sign in to see events near you</p>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">
          Join a workshop or meetup, or host your own. Public events are always listed on the Events page.
        </p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-1 gap-3 sm:grid-cols-2">
        <GlassCta to={`/auth?next=${next}`} size="sm" className="min-h-11 w-full justify-center sm:min-h-0">
          Sign in
        </GlassCta>
        <OutlineCta to="/meetup" size="sm" className="min-h-11 w-full sm:min-h-0">
          Browse events
        </OutlineCta>
      </div>
    </div>
  );
}

export default SessionsGuestGate;
