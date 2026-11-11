/**
 * Where the opportunity space lives, written once.
 *
 * Scout owns work discovery and the marketplace. Old opportunity addresses remain compatible with bookmarks and Company management.
 */
export const OPPORTUNITIES_PATH = "/opportunities";
export const SCOUT_PATH = "/scout";
/** Kept for consumers that still reference the former alias name. */
export const LEGACY_SCOUT_PATH = "/scout";

/** True on every page of the opportunity space: the feed, Scout (at either address), one opportunity, and the poster's dashboard. */
export function isOpportunitySpace(pathname: string): boolean {
  return pathname.startsWith("/opportunit") || pathname === LEGACY_SCOUT_PATH || pathname.startsWith(`${LEGACY_SCOUT_PATH}/`);
}

/** Preserve feed selections when opening the merged Scout workspace. */
export function scoutFeedTarget(search: string): string {
  const params = new URLSearchParams(search);
  const marketplace = params.get("view") === "marketplace" || params.get("tab") === "marketplace";
  params.delete("view");
  if (marketplace) params.set("tab", "marketplace");
  else if (!params.has("tab")) params.set("tab", "scouted");
  return `${SCOUT_PATH}?${params.toString()}`;
}
