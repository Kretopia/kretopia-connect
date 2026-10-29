// The honest labels of a discovered listing. Pure: the same words everywhere a listing shows.
//
// External is not registered, partnered, verified or available. A label says only what is true of the record.

export interface ListingLabelInput {
  origin: "kretopia" | "external";
  claimed: boolean;
  /** When the source was last read or checked, if it ever was. */
  last_checked_at: string | null;
  source_name: string | null;
}

export interface ListingLabels {
  origin: "Kretopia" | "External";
  /** Only external listings carry an ownership label. */
  ownership: "Claimed" | "Unclaimed" | null;
  lastChecked: string | null; // "Last checked 3 days ago", or null when never
  source: string | null; // "via Remote OK"
}

/**
 * What each approved source is called where people read it. A listing stores the adapter's id ("jobicy"), but the credit a source's
 * terms ask for is its NAME ("via Jobicy"). Kept in step with the registry's names by a test; an id nobody listed is shown as it is.
 */
export const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  remoteok: "Remote OK",
  weworkremotely: "We Work Remotely",
  jobicy: "Jobicy",
  arbeitnow: "Arbeitnow",
  "web-search": "Web search provider",
};

export function sourceDisplayName(id: string | null): string | null {
  return id ? SOURCE_DISPLAY_NAMES[id] ?? id : null;
}

/**
 * The rel of a link that leads to a source's own page. Third-party links carry nofollow, except where a source's terms ask for
 * a followed link back: Remote OK's API notice reads "link back (with follow, and without nofollow!) to the URL on Remote OK and
 * mention Remote OK as a source", or API access is suspended (read from the API itself, 2026-10-29).
 */
const FOLLOWED_LINK_BACK = new Set(["remoteok"]);
export function sourceLinkRel(id: string | null | undefined): string {
  return id && FOLLOWED_LINK_BACK.has(id) ? "noopener noreferrer" : "noopener noreferrer nofollow";
}

export function relativeDays(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function listingLabels(l: ListingLabelInput, now: Date): ListingLabels {
  const when = relativeDays(l.last_checked_at, now);
  return {
    origin: l.origin === "external" ? "External" : "Kretopia",
    ownership: l.origin === "external" ? (l.claimed ? "Claimed" : "Unclaimed") : null,
    lastChecked: l.origin === "external" && when ? `Last checked ${when}` : null,
    source: l.origin === "external" && l.source_name ? `via ${sourceDisplayName(l.source_name)}` : null,
  };
}
