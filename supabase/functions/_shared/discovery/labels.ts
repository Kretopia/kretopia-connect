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
    source: l.origin === "external" && l.source_name ? `via ${l.source_name}` : null,
  };
}
