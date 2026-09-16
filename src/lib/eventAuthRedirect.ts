/**
 * Round-trip contract for unauthenticated RSVP → /auth → back to event.
 *
 * Two pure helpers shared by EventPage (outbound) and Auth (return), so
 * the URL shape can't drift between them.
 */

/**
 * URL an unauthenticated guest is sent to when a host requires an account
 * before RSVP. Auth.tsx reads `?event=` and uses it as the post-auth target.
 */
export function buildEventAuthUrl(eventId: string): string {
  return `/auth?event=${eventId}&tab=signup`;
}

/**
 * Compute the post-auth redirect target. If the user came from an event
 * RSVP gate (`?event=<id>`), send them back to that event page. Otherwise
 * falls through, in order: `?next=` (the param every Landing chapter CTA
 * sets -- was previously read nowhere, so every CTA's promised destination
 * silently dropped to "/" after signup), `?redirect=`, a sessionStorage
 * stash, then a default.
 */
export function computePostAuthRedirect(opts: {
  eventId?: string | null;
  claimProfileId?: string | null;
  nextParam?: string | null;
  redirectParam?: string | null;
  stashedRedirect?: string | null;
  fallback?: string;
}): string {
  if (opts.claimProfileId) return `/profile/${opts.claimProfileId}?showClaim=true`;
  if (opts.eventId) return `/event/${opts.eventId}`;
  return opts.nextParam || opts.redirectParam || opts.stashedRedirect || opts.fallback || "/";
}
