import { APP_URL } from "@/lib/constants";

// Where the link in an auth email (sign-up confirmation, magic link) must land.
//
// These used `window.location.origin`, so anyone who signed up from the Lovable
// preview / published host (*.lovable.app, *.lovableproject.com) got an email whose
// button opened that host, not kretopia.com. The canonical site is used everywhere
// except a local dev server, where the link has to come back to localhost.
//
// Note: the identity provider only honours a redirect that is on its allow-list; the
// Auth "Site URL" and "Redirect URLs" must include https://www.kretopia.com.

const isLocalHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");

export function getAuthOrigin(): string {
  if (typeof window === "undefined") return APP_URL;
  const { hostname, origin } = window.location;
  return isLocalHost(hostname) ? origin : APP_URL;
}

/** Confirmed members finish their profile before opening their Passport. */
export const POST_SIGNUP_PATH = "/onboarding";

export const getPostSignupUrl = (): string => `${getAuthOrigin()}${POST_SIGNUP_PATH}`;
