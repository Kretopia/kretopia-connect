import { useEffect } from "react";

/**
 * Route prefetching: when the user hovers, focuses or touches an internal
 * link, we start downloading that page's lazy chunk immediately. By the time
 * the click lands, the module is already in the browser cache and React's
 * lazy() resolves without a network wait — navigation feels instant.
 *
 * The map mirrors the lazy() imports in App.tsx. Each entry is matched by
 * longest pathname prefix; "/" is exact-only so it doesn't swallow everything.
 */
const ROUTE_IMPORTS: Array<[string, () => Promise<unknown>]> = [
  ["/auth", () => import("../pages/Auth")],
  ["/match", () => import("../pages/Match")],
  ["/scout", () => import("../pages/Scout")],
  ["/messages", () => import("../pages/Messages")],
  ["/notifications", () => import("../pages/Notifications")],
  ["/passport", () => import("../pages/Profile")],
  ["/profile", () => import("../pages/Profile")],
  ["/credits", () => import("../pages/CreditsDashboard")],
  ["/desk", () => import("../pages/ThriveDesk")],
  ["/circles", () => import("../pages/Circles")],
  ["/circle", () => import("../pages/Circle")],
  ["/crews", () => import("../pages/Circles")],
  ["/opportunities", () => import("../pages/Opportunities")],
  ["/settings", () => import("../pages/Settings")],
  ["/search", () => import("../pages/SearchResults")],
  ["/discover", () => import("../pages/Discover")],
  ["/nearby", () => import("../pages/NearbyCreators")],
  ["/soundstages", () => import("../pages/SoundStages")],
  ["/sound-stages", () => import("../pages/SoundStages")],
  ["/thrivepay", () => import("../pages/ThrivePay")],
  ["/wallet", () => import("../pages/ThrivePay")],
  ["/about", () => import("../pages/About")],
  ["/spotlight", () => import("../pages/Spotlight")],
  ["/magazine", () => import("../pages/Magazine")],
  ["/meetup", () => import("../pages/Meetup")],
  ["/shortlists", () => import("../pages/Shortlists")],
  ["/clients", () => import("../pages/Clients")],
  ["/subscription", () => import("../pages/Subscription")],
  ["/recordings", () => import("../pages/Recordings")],
  ["/onboarding", () => import("../pages/Onboarding")],
];

const HOME_IMPORT = () => import("../components/home/UnifiedHome");

/** Module paths already requested this session — never fetch twice. */
const prefetched = new Set<string>();

export function prefetchRoute(pathname: string): void {
  const path = pathname.split(/[?#]/)[0];
  if (prefetched.has(path)) return;

  let importer: (() => Promise<unknown>) | undefined;
  if (path === "/" || path === "") {
    importer = HOME_IMPORT;
  } else {
    // Longest-prefix match so "/circle/speed" prefers "/circle" over nothing
    // and "/soundstages" doesn't get swallowed by a shorter sibling.
    let best = "";
    for (const [prefix, fn] of ROUTE_IMPORTS) {
      if (path.startsWith(prefix) && prefix.length > best.length) {
        best = prefix;
        importer = fn;
      }
    }
  }
  if (!importer) return;

  prefetched.add(path);
  // Fire-and-forget: a failed prefetch must never break navigation — the
  // lazy() import on click will simply do its own fetch (with retry).
  void importer().catch(() => {
    prefetched.delete(path);
  });
}

/**
 * Global listener: warms route chunks on hover/focus/touch of internal links.
 * Mounted once near the app root; uses event delegation so it works for links
 * rendered later by any feature.
 */
export function RoutePrefetcher() {
  useEffect(() => {
    const onIntent = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href^='/']") as HTMLAnchorElement | null;
      if (!anchor) return;
      // Skip modifier-click/new-tab intents and external-lookalike URLs.
      if (anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      prefetchRoute(anchor.pathname);
    };

    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("focusin", onIntent, { passive: true });
    document.addEventListener("touchstart", onIntent, { passive: true });
    return () => {
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
      document.removeEventListener("touchstart", onIntent);
    };
  }, []);

  return null;
}
