// A Scout feed candidate (the parsers in scoutSources.ts) as the raw input of the extraction validator. Pure.
//
// Feeds state their own posting date, which IS the source publication date; a feed without one leaves it unknown.
// `compensation` in the feeds is free text ("$80k - $100k", "Competitive"): it stays unknown as a structured budget
// rather than being guessed into one. The description is cut to a short excerpt; the full text is not stored.

import type { FeedCandidate } from "./feeds.ts";
import { EXCERPT_MAX } from "./extract.ts";

export function candidateToRaw(c: FeedCandidate): Record<string, unknown> {
  return {
    kind: "gig",
    title: c.title,
    original_publisher: c.company,
    location: c.location,
    remote_scope: c.remote ? "remote" : null,
    source_published_at: c.posted_at,
    apply_url: c.apply_url || c.source_url,
    excerpt: c.description ? c.description.slice(0, EXCERPT_MAX * 2) : null,
    // Only what a source states structurally: the date it stops listing the job, and a pay range given as numbers with a currency code.
    ...(c.expires_at ? { deadline_at: c.expires_at } : {}),
    ...(c.budget ? { budget: c.budget } : {}),
  };
}
