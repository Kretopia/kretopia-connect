/**
 * Which pieces of the app's frame a route wears.
 *
 * The top navbar is Kretopia's own frame and every page that is part of the
 * product wears it. It is left off only where the page is a standalone surface
 * of its own: the creator website builder and sites, sign-in, onboarding, the
 * deck, and a model's comp card. A public Passport (/epk/:id) is the product's
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

  const standalone = isCreatorSite || isAuthPage || isOnboardingPage || isDeckPage;
  return {
    showNavbar: !standalone && !isCompCard,
    showBottomNav: !standalone && !isCompCard && !isPublicPassport && signedIn,
  };
}
