import { isInAppPath } from "@/lib/inAppPath";

/**
 * Where a person was going when they had to sign up (a Co-Sign request, an invitation, an opportunity). The confirmation email always
 * opens /onboarding, and onboarding ends on the new Passport, so without this the original destination was lost. It travels two ways:
 * in this browser's session (the same key soft-gates already use), and in the account's own metadata, so it survives opening the
 * confirmation email on another device. Only an address inside the app is ever kept.
 */
export const POST_SIGNUP_STASH_KEY = "thrivein_post_auth_redirect";
export const POST_SIGNUP_META_KEY = "post_signup_next";

// The account's own start-up pages are not a destination: they are where the person already is, or where they are sent anyway.
// (Someone else's Passport, /profile/<id>, is a real destination: a person may sign up to connect with them.)
const NOT_A_DESTINATION = /^(?:\/(?:auth|onboarding)(?:[/?#].*)?|\/profile(?:[?#].*)?|\/(?:[?#].*)?)$/;
const MAX_LENGTH = 400;

/** The address worth keeping, or null (not an in-app address, too long, the home page, or a start-up page). */
export function usableDestination(path: unknown): string | null {
  if (!isInAppPath(path) || path.length > MAX_LENGTH) return null;
  if (path === "/" || NOT_A_DESTINATION.test(path)) return null;
  return path;
}

interface MetaUser { user_metadata?: Record<string, unknown> | null }

/** What the account was created heading for, if anything usable. */
export function destinationFromAccount(user: MetaUser | null | undefined): string | null {
  return usableDestination(user?.user_metadata?.[POST_SIGNUP_META_KEY]);
}

/** The metadata to add to a sign-up request: nothing when there is no destination worth keeping. */
export function signupDestinationData(path: unknown): Record<string, string> {
  const destination = usableDestination(path);
  return destination ? { [POST_SIGNUP_META_KEY]: destination } : {};
}

/**
 * The destination to continue to once the Passport is built, used once: this browser's stash first (and cleared), then the account's.
 * `clearAccount` is called when the account's copy was used, so the next sign-in never replays it.
 */
export function takePostSignupDestination(user: MetaUser | null | undefined, clearAccount?: () => void): string | null {
  let stashed: string | null = null;
  try {
    stashed = sessionStorage.getItem(POST_SIGNUP_STASH_KEY);
    if (stashed) sessionStorage.removeItem(POST_SIGNUP_STASH_KEY);
  } catch { /* storage unavailable: the account's copy still works */ }
  const fromStash = usableDestination(stashed);
  const fromAccount = destinationFromAccount(user);
  if (fromAccount) clearAccount?.();
  return fromStash ?? fromAccount;
}
