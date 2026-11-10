/**
 * Where the opportunity space lives, written once.
 *
 * Opportunities is the one place for work: the gigs feed at /opportunities and, inside it, Scout (the personalised search and shortlist) at
 * /opportunities/scout. Scout used to be a second top-level destination at /scout with a nav entry of its own. That address is an alias now:
 * it redirects to Scout's place here, with its query string and hash, so a bookmark, an email or an in-app link to it still lands on Scout.
 */
export const OPPORTUNITIES_PATH = "/opportunities";
export const SCOUT_PATH = "/opportunities/scout";
/** Scout's old top-level address. It stays routable and redirects to SCOUT_PATH. */
export const LEGACY_SCOUT_PATH = "/scout";

/** True on every page of the opportunity space: the feed, Scout (at either address), one opportunity, and the poster's dashboard. */
export function isOpportunitySpace(pathname: string): boolean {
  return pathname.startsWith("/opportunit") || pathname === LEGACY_SCOUT_PATH || pathname.startsWith(`${LEGACY_SCOUT_PATH}/`);
}
