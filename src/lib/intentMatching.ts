/**
 * Intent-based matching & feed re-ordering (Phase 2).
 *
 * Two functions:
 *  1. intentBoostForCreator() — score boost when viewing another creator card
 *     based on complementary intents (e.g. "gigs" ↔ "hire").
 *  2. intentBoostForGig() — score boost for a gig listing based on viewer intent.
 *  3. intentBoostForEvent() — score boost for events based on viewer intent.
 *
 * Complementary pairs:
 *   gigs ↔ hire           (job seeker meets employer)
 *   collaborate ↔ collaborate (mutual collab)
 *   fund ↔ collaborate    (project builders find allies)
 *   manage ↔ hire         (PMs find brands)
 */
import { normalizeIntents, PrimaryIntent } from "./intents";

const COMPLEMENTARY: Record<PrimaryIntent, PrimaryIntent[]> = {
  gigs: ["hire"],
  hire: ["gigs", "manage"],
  collaborate: ["collaborate", "fund"],
  fund: ["collaborate", "fund"],
  manage: ["hire", "manage"],
};

/** Boost when current user looks at another creator. */
export function intentBoostForCreator(
  myIntents: unknown,
  theirIntents: unknown
): { boost: number; reason: string | null } {
  const mine = normalizeIntents(myIntents);
  const theirs = normalizeIntents(theirIntents);
  if (mine.length === 0 || theirs.length === 0) return { boost: 0, reason: null };

  let boost = 0;
  let reason: string | null = null;

  for (const m of mine) {
    for (const t of theirs) {
      if (COMPLEMENTARY[m]?.includes(t)) {
        boost += 8;
        if (!reason) reason = labelForPair(m, t);
      }
    }
  }
  return { boost: Math.min(boost, 20), reason };
}

/** Boost a gig listing for a viewer based on intent. */
export function intentBoostForGig(myIntents: unknown): number {
  const mine = normalizeIntents(myIntents);
  if (mine.includes("gigs")) return 10;
  if (mine.includes("collaborate")) return 4;
  return 0;
}

/** Boost an event/session for a viewer based on intent. */
export function intentBoostForEvent(myIntents: unknown): number {
  const mine = normalizeIntents(myIntents);
  if (mine.includes("collaborate")) return 6;
  if (mine.includes("fund")) return 3;
  return 0;
}

function labelForPair(mine: PrimaryIntent, theirs: PrimaryIntent): string {
  if (mine === "gigs" && theirs === "hire") return "They're hiring — you're looking";
  if (mine === "hire" && theirs === "gigs") return "Available for hire";
  if (mine === "collaborate" && theirs === "collaborate") return "Both open to collaborate";
  if (mine === "fund" && theirs === "collaborate") return "Could collaborate on your project";
  if (mine === "collaborate" && theirs === "fund") return "Has a project to build";
  if (mine === "manage" && theirs === "hire") return "Hiring — you can manage";
  return "Complementary goals";
}
