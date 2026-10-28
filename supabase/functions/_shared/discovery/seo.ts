// What a public listing page may claim to search engines. Pure.
//
// Principles, each enforced below and tested:
//   * a page is indexable only with enough PERMITTED content, a real publisher, real provenance and an actionable
//     destination; drafts, private records, unreviewed or flagged imports and expired listings are noindex;
//   * JobPosting markup appears only on an individual job detail page, only with real facts that match what the page
//     shows, and never with an invented employer, posting date, salary or "direct apply";
//   * an unclaimed external listing never gets JobPosting: Kretopia holds a short excerpt and a link, not the
//     publisher's job description, so the structured data would not match a full posting;
//   * a closed or expired job loses its markup and leaves the sitemap on the same rule that makes it noindex.

import type { Budget } from "./extract.ts";

export const MIN_INDEXABLE_CHARS = 200;

export interface ListingSeoInput {
  kind: "gig" | "event" | "talent";
  status: string; // draft | in_review | published | claimed | expired | removed | rejected
  visibility: string; // private | review | public
  title: string | null;
  original_publisher: string | null;
  excerpt: string | null;
  /** The publisher's own description, supplied by a VERIFIED owner after a claim. */
  description_full: string | null;
  apply_url: string | null;
  source_published_at: string | null;
  deadline_at: string | null;
  starts_at: string | null;
  location: string | null;
  remote_scope: string | null;
  budget: Budget | null;
  flagged_instructions: boolean;
  /** Kretopia-hosted applications enabled after review. Without it a listing never claims "direct apply". */
  applications_enabled: boolean;
  url: string; // the canonical Kretopia URL of this page
}

const PUBLIC_STATUSES = new Set(["published", "claimed"]);
const len = (s: string | null | undefined) => (s ?? "").trim().length;

export function isExpired(l: Pick<ListingSeoInput, "status" | "deadline_at" | "starts_at" | "kind">, now: Date): boolean {
  if (l.status === "expired" || l.status === "removed" || l.status === "rejected") return true;
  if (l.deadline_at && new Date(l.deadline_at).getTime() < now.getTime()) return true;
  if (l.kind === "event" && l.starts_at && new Date(l.starts_at).getTime() < now.getTime() - 86_400_000) return true;
  return false;
}

export function robotsFor(l: ListingSeoInput, now: Date): "index, follow" | "noindex, nofollow" {
  const sufficient = Math.max(len(l.excerpt), len(l.description_full)) >= MIN_INDEXABLE_CHARS;
  const ok =
    PUBLIC_STATUSES.has(l.status) &&
    l.visibility === "public" &&
    !l.flagged_instructions &&
    !isExpired(l, now) &&
    len(l.title) >= 3 &&
    len(l.original_publisher) > 0 &&
    len(l.apply_url) > 0 &&
    sufficient;
  return ok ? "index, follow" : "noindex, nofollow";
}

export function isSitemapEligible(l: ListingSeoInput, now: Date): boolean {
  return robotsFor(l, now) === "index, follow";
}

const UNIT: Record<string, string> = { hour: "HOUR", day: "DAY", week: "WEEK", month: "MONTH", year: "YEAR" };

export interface JobPostingFacts {
  title: string;
  description: string;
  datePosted: string; // a date the source or the owner really states
  validThrough: string | null;
  organization: string;
  location: string | null;
  remote: boolean;
  budget: Budget | null;
  directApply: boolean;
  url: string;
}

/** The markup for facts that were already judged eligible. Returns null when a required fact is missing. */
export function jobPostingFrom(f: JobPostingFacts): Record<string, unknown> | null {
  if (!f.title || !f.description || !f.datePosted || !f.organization || !f.url) return null;
  if (!f.remote && !f.location) return null; // Google needs a place; we do not invent one
  if (f.remote && !f.location) return null; // remote needs an applicant country, which we do not have as a country
  const posting: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: f.title,
    description: f.description,
    datePosted: f.datePosted.slice(0, 10),
    hiringOrganization: { "@type": "Organization", name: f.organization },
    url: f.url,
  };
  if (f.validThrough) posting.validThrough = f.validThrough;
  if (f.remote) {
    posting.jobLocationType = "TELECOMMUTE";
  } else if (f.location) {
    posting.jobLocation = { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: f.location } };
  }
  const b = f.budget;
  if (b && b.currency && b.period && UNIT[b.period] && (b.min !== null || b.max !== null)) {
    posting.baseSalary = {
      "@type": "MonetaryAmount",
      currency: b.currency,
      value: { "@type": "QuantitativeValue", ...(b.min !== null ? { minValue: b.min } : {}), ...(b.max !== null ? { maxValue: b.max } : {}), unitText: UNIT[b.period] },
    };
  }
  if (f.directApply) posting.directApply = true;
  return posting;
}

/** JobPosting for an external listing page: only a CLAIMED gig whose verified owner supplied the full description. */
export function externalJobPosting(l: ListingSeoInput, now: Date): Record<string, unknown> | null {
  if (l.kind !== "gig" || l.status !== "claimed") return null;
  if (robotsFor(l, now) !== "index, follow") return null;
  if (len(l.description_full) < MIN_INDEXABLE_CHARS) return null;
  if (!l.source_published_at) return null; // no invented datePosted
  return jobPostingFrom({
    title: l.title ?? "",
    description: l.description_full ?? "",
    datePosted: l.source_published_at,
    validThrough: l.deadline_at,
    organization: l.original_publisher ?? "",
    location: l.location,
    remote: l.remote_scope === "remote",
    budget: l.budget,
    directApply: l.applications_enabled,
    url: l.url,
  });
}

export interface NativeGigFacts {
  scouted_by: string | null;
  status: string | null;
  title: string;
  description: string;
  created_at: string | null;
  application_deadline: string | null;
  organization: string | null; // the poster's real organization name, when known
  location: string | null;
  url: string;
}

/**
 * JobPosting for a gig posted on Kretopia by the employer itself. Scouted gigs (found elsewhere) never qualify: their
 * created_at is when WE found them, not when they were posted, and Kretopia is not their employer. Pay stays out
 * unless it is structured, and Kretopia never stands in as the hiring organization.
 */
export function nativeGigJobPosting(g: NativeGigFacts, now: Date): Record<string, unknown> | null {
  if (g.scouted_by) return null;
  if (g.status !== "active" && g.status !== "open") return null;
  if (g.application_deadline && new Date(g.application_deadline).getTime() < now.getTime()) return null;
  if (len(g.description) < MIN_INDEXABLE_CHARS || !g.organization || !g.created_at || !g.location) return null;
  return jobPostingFrom({
    title: g.title,
    description: g.description,
    datePosted: g.created_at,
    validThrough: g.application_deadline,
    organization: g.organization,
    location: g.location,
    remote: false,
    budget: null,
    directApply: false,
    url: g.url,
  });
}

export function nativeGigRobots(g: Pick<NativeGigFacts, "scouted_by" | "status" | "application_deadline">, claimStatus: string | null, now: Date): "index, follow" | "noindex, nofollow" {
  if (g.scouted_by && claimStatus !== "claimed") return "noindex, nofollow"; // an unclaimed import is not ours to index
  if (g.status !== "active" && g.status !== "open") return "noindex, nofollow";
  if (g.application_deadline && new Date(g.application_deadline).getTime() < now.getTime()) return "noindex, nofollow";
  return "index, follow";
}

/** Event markup only with the facts the listing really has: a name, a start, a place, a page. */
export function eventJsonLd(l: ListingSeoInput, now: Date): Record<string, unknown> | null {
  if (l.kind !== "event" || robotsFor(l, now) !== "index, follow") return null;
  if (!l.starts_at || !l.location || !l.title) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: l.title,
    startDate: l.starts_at,
    location: { "@type": "Place", name: l.location },
    url: l.url,
    ...(l.original_publisher ? { organizer: { "@type": "Organization", name: l.original_publisher } } : {}),
  };
}
