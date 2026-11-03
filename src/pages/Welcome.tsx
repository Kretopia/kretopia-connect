import { KretopiaLanding } from "@/components/landing/KretopiaLanding";

// Welcome is already a lazy route: its first visible content must not wait
// for an additional import waterfall. Chapters retain their separate split.

/**
 * The real marketing landing page, reachable at /landing regardless of
 * auth state -- unlike "/", which renders TodayDashboard once signed in.
 * Exists so the Navbar's Kretopia logo can always return here, even from
 * an authenticated profile: Navbar shows the normal signed-out CTAs to a
 * guest here and a small connected-avatar trigger instead of them to a
 * signed-in user (see Navbar.tsx's own isLandingPage handling) -- this
 * page itself doesn't need to know or care which.
 */
const Welcome = () => (
  <KretopiaLanding onSearchSubmit={() => {}} />
);

export default Welcome;
