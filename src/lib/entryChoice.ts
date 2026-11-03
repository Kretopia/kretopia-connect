import { isInAppPath } from "@/lib/inAppPath";

/**
 * The first screen of a join link or an invitation, for someone who is not signed in: sign in, or continue as a guest.
 *
 * The choice is remembered for this tab's session only (sessionStorage, per entry, so a "guest" for one invitation is never assumed for
 * another). It is never written to localStorage, a cookie or the server, and signing in makes it moot: a signed-in person is never asked.
 */
export type EntryChoice = "guest";

/** How long the page waits to learn whether someone is signed in before it shows the choice anyway: the choice needs no session to render. */
export const AUTH_WAIT_MS = 1200;

export const entryChoiceKey = (target: string) => `entry-choice:${target}`;

/** The sign-in page, told to bring the person back to `returnTo` (an in-app address; anything else falls back to the home page). */
export function signInHref(returnTo: string): string {
  const next = isInAppPath(returnTo) ? returnTo : "/";
  return `/auth?redirect=${encodeURIComponent(next)}`;
}
