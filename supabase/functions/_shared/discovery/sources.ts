// The approved source registry for external discovery. Pure data and helpers.
//
// A source is approved ONLY when its terms allow what Kretopia does with it (link to the original, show a short
// excerpt, never copy the full text or images, never hide it behind a sign-up wall) and a cost is known. Every
// adapter is `enabledByDefault: false`: turning one on is an explicit, recorded decision (discovery_sources.enabled).
// Remotive is deliberately absent: its terms forbid showing its jobs behind a sign-up wall (see scoutSources.ts).
//
// A search provider (Firecrawl, a web-search API) is listed with `costPerCallCents: null` and `requiresCredential`:
// an adapter whose cost is unknown stays disabled, and a missing credential blocks only the live call, never the
// local implementation.

import { hostMatches } from "../ssrf.ts";

export type ListingKind = "gig" | "event" | "talent";

export interface SourceAdapter {
  id: string;
  name: string;
  kind: ListingKind;
  /** Hosts that may be fetched for this source (exact or "*.domain"). */
  hosts: string[];
  /** The documented public feed, when there is one (fetched through safeFetchBounded). */
  feedUrls: string[];
  feedFormat: "json" | "rss" | null;
  requiresCredential: string | null;
  /** Cost of one call in cents, or null when unknown (then the adapter cannot be enabled). */
  costPerCallCents: number | null;
  enabledByDefault: false;
  terms: string;
}

export const SOURCE_ADAPTERS: SourceAdapter[] = [
  {
    id: "remoteok", name: "Remote OK", kind: "gig", hosts: ["remoteok.com"],
    feedUrls: ["https://remoteok.com/api"], feedFormat: "json", requiresCredential: null, costPerCallCents: 0, enabledByDefault: false,
    terms: "Public API. Link back to the original posting and name Remote OK as the source.",
  },
  {
    id: "weworkremotely", name: "We Work Remotely", kind: "gig", hosts: ["weworkremotely.com"],
    feedUrls: ["https://weworkremotely.com/categories/remote-design-jobs.rss", "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss"],
    feedFormat: "rss", requiresCredential: null, costPerCallCents: 0, enabledByDefault: false,
    terms: "Public RSS. Link back to the original posting and name We Work Remotely as the source.",
  },
  {
    id: "jobicy", name: "Jobicy", kind: "gig", hosts: ["jobicy.com"],
    feedUrls: ["https://jobicy.com/api/v2/remote-jobs?count=50&industry=design-multimedia", "https://jobicy.com/api/v2/remote-jobs?count=50&industry=marketing"],
    feedFormat: "json", requiresCredential: null, costPerCallCents: 0, enabledByDefault: false,
    terms: "Public API. Link back to the original posting and name Jobicy as the source.",
  },
  {
    id: "arbeitnow", name: "Arbeitnow", kind: "gig", hosts: ["arbeitnow.com", "www.arbeitnow.com"],
    feedUrls: ["https://www.arbeitnow.com/api/job-board-api"], feedFormat: "json", requiresCredential: null, costPerCallCents: 0, enabledByDefault: false,
    terms: "Public API. Link back to the original posting and name Arbeitnow as the source.",
  },
  {
    // Terms read 2026-10-29 (himalayas.app/docs/remote-jobs-api and clause 113 of himalayas.app/terms): free, no key, personal and commercial use
    // without asking, on sites and apps you operate. Conditions: a visible credit and link to Himalayas, every apply action on the job's own
    // Himalayas page (applicationLink), jobs removed once they expire, nothing passed on to other boards, aggregators, Google Jobs or LinkedIn
    // (no JobPosting data). The feed refreshes daily: polling more often gains nothing. Tested queries only; there is no category filter.
    id: "himalayas", name: "Himalayas", kind: "gig", hosts: ["himalayas.app"],
    feedUrls: [
      "https://himalayas.app/jobs/api/search?q=video%20editor&sort=recent",
      "https://himalayas.app/jobs/api/search?q=motion%20designer&sort=recent",
      "https://himalayas.app/jobs/api/search?q=art%20director&sort=recent",
      "https://himalayas.app/jobs/api/search?q=photographer&sort=recent",
      "https://himalayas.app/jobs/api/search?q=illustrator&sort=recent",
      "https://himalayas.app/jobs/api/search?q=copywriter&sort=recent",
      "https://himalayas.app/jobs/api/search?q=content%20creator&sort=recent",
      "https://himalayas.app/jobs/api/search?q=designer&sort=recent",
    ],
    feedFormat: "json", requiresCredential: null, costPerCallCents: 0, enabledByDefault: false,
    terms: "Public API, no key. Credit Himalayas with a visible link, apply only through the job's own Himalayas page, show the jobs only on Kretopia, remove a job once it expires, never pass them on to other job boards or aggregators. Poll at most once a day.",
  },
  {
    id: "web-search", name: "Web search provider", kind: "gig", hosts: [], feedUrls: [], feedFormat: null,
    requiresCredential: "FIRECRAWL_API_KEY", costPerCallCents: null, enabledByDefault: false,
    terms: "Not approved: provider pricing and the terms of each result site are unconfirmed. Stays disabled.",
  },
];

export function adapterById(id: string): SourceAdapter | undefined {
  return SOURCE_ADAPTERS.find((a) => a.id === id);
}

/** The adapter whose hosts cover this URL, or null when the URL is not on an approved source. */
export function adapterForUrl(url: string): SourceAdapter | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return SOURCE_ADAPTERS.find((a) => a.hosts.length > 0 && hostMatches(host, a.hosts)) ?? null;
}

export function approvedHosts(adapterIds?: string[]): string[] {
  return SOURCE_ADAPTERS.filter((a) => !adapterIds || adapterIds.includes(a.id)).flatMap((a) => a.hosts);
}

/** Why an adapter cannot be enabled right now, or null when nothing blocks it. */
export function enableBlocker(a: SourceAdapter, env: { get(name: string): string | undefined }): string | null {
  if (a.costPerCallCents === null) return "cost per call is unknown";
  if (a.requiresCredential && !env.get(a.requiresCredential)) return `missing credential ${a.requiresCredential}`;
  if (a.feedUrls.length === 0 && a.hosts.length === 0) return "no approved host or feed";
  return null;
}
