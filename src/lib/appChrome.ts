import { SCOUT_PATH } from "@/lib/opportunityRoutes";

/**
 * Which pieces of the app's frame a route wears.
 *
 * The top navbar is Kretopia's own frame and every page that is part of the
 * product wears it. It is left off only where the page is a standalone surface
 * of its own: the creator website builder and sites, sign-in, onboarding, the
 * deck, a model's comp card, and a join link to a live call (/meet/:id, /call/:token), whose own screens
 * (choice, name, lobby) must not sit under the site's bars. A public Passport (/epk/:id) is the product's
 * public face, so it wears the navbar; only the bottom nav, which is for
 * signed-in navigation, stays off it.
 */
export interface AppChrome {
  showNavbar: boolean;
  showBottomNav: boolean;
}

export function appChrome(pathname: string, signedIn: boolean): AppChrome {
  const isPublicPassport = /^\/epk\/[^/]+$/.test(pathname);
  const isCompCard = /^\/comp\/[^/]+$/.test(pathname);
  const isCreatorSite = /^\/site\/[^/]+$/.test(pathname) || pathname === "/website-builder";
  const isAuthPage = pathname === "/auth";
  const isOnboardingPage = pathname === "/onboarding" || pathname === "/company-onboarding";
  const isDeckPage = pathname === "/deck";
  const isJoinLink = /^\/(call|meet)\/[^/]+$/.test(pathname);

  const standalone = isCreatorSite || isAuthPage || isOnboardingPage || isDeckPage || isJoinLink;
  return {
    showNavbar: !standalone && !isCompCard,
    showBottomNav: !standalone && !isCompCard && !isPublicPassport && signedIn,
  };
}

/** The Landing page's footer (EditorialFooter) comes in two layouts. */
export type AppFooterVariant = "default" | "balanced";

// Pages that have worn the shared footer since before it was extended: they keep the default layout, which they share with pages owned elsewhere.
const DEFAULT_FOOTER_PATHS = new Set(["/discover", "/passport", "/post-opportunity"]);
// The legal documents: the evened-out layout, since no audience page owns them.
const LEGAL_FOOTER_PATHS = new Set(["/terms", "/privacy", "/community-guidelines"]);
// The product's feature pages: Studio, Scout, the private Passport, Match and Events. The evened-out layout (4 / 4 / 4 / 5 links, two by two on a phone).
const FEATURE_FOOTER_PATHS = new Set(["/desk", SCOUT_PATH, "/profile", "/match", "/meetup"]);
// One event, and a Passport anybody can open (/epk/:id, and /profile/:id which resolves to the same page). Not /event/:id/confirmed or /pass, not /profile/edit's redirect target.
const FEATURE_FOOTER_PATTERNS = [/^\/event\/[^/]+$/, /^\/epk\/[^/]+$/, /^\/profile\/[^/]+$/];

/**
 * Which of the Landing page's footers the shared layout draws under a route, or null for none. The decision is made here, once, for every
 * page, so a page never pastes the footer in and never gets two.
 *
 * It is an allow-list: a route that is not named here has no footer, which is how the full-screen and dedicated workflows keep their whole
 * screen (a Studio project room /desk/:id, the new-room form, messages and Kreto's chat, live stages and speed sessions, call join links).
 * Whatever has no navbar (sign-in, onboarding, creator sites, the deck, a comp card, a join link) never has a footer either. Pages that draw
 * their own (the Landing page and its signed-out Today, Pricing and Subscription) are left out so they do not get a second one.
 */
export function appFooter(pathname: string, signedIn: boolean): AppFooterVariant | null {
  if (!appChrome(pathname, signedIn).showNavbar) return null;
  // Today: a signed-out visitor sees the Landing page there, which ends in its own footer.
  if (pathname === "/") return signedIn ? "balanced" : null;
  if (DEFAULT_FOOTER_PATHS.has(pathname)) return "default";
  if (LEGAL_FOOTER_PATHS.has(pathname)) return "balanced";
  if (FEATURE_FOOTER_PATHS.has(pathname) || FEATURE_FOOTER_PATTERNS.some((pattern) => pattern.test(pathname))) return "balanced";
  return null;
}

/**
 * The room the footer keeps free at its foot below `lg`, where the page has something fixed to the bottom of the screen: the signed-in
 * bottom nav, and the Event page's booking bar. Without it the footer's last line could not be scrolled out from under them. From `lg`
 * neither exists.
 */
export function footerBottomReserve(pathname: string, showBottomNav: boolean): string {
  if (/^\/event\/[^/]+$/.test(pathname)) return "pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-0";
  return showBottomNav ? "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0" : "";
}

// Full-screen or public surfaces where the Kreto mascot must not float over the page on a phone:
// sign-in and onboarding, calls, the messages composer, public profiles and sites.
const KRETO_MASCOT_HIDDEN_PREFIXES = [
  "/auth",
  "/login",
  "/signup",
  "/onboarding",
  "/claim",
  "/accept-invite",
  "/landing",
  "/check-in",
  "/call/",
  "/guest-call",
  "/messages",
  "/epk/",
  "/u/",
  "/site/",
  "/website-builder",
];

/**
 * Whether the Kreto mascot floats above the bottom nav on a phone (below `lg`). It replaces the
 * docked "Ask Kreto" composer bar, so it follows the same rule that bar followed: only where the
 * bottom nav shows, and not on the full-screen or public surfaces above. Desktop always shows the
 * mascot (see KretoLauncher) and does not use this.
 */
export function showKretoMascotOnMobile(pathname: string, signedIn: boolean): boolean {
  if (!appChrome(pathname, signedIn).showBottomNav) return false;
  return !KRETO_MASCOT_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
