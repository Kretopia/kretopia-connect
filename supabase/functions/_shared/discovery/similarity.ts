// Possible-duplicate detection for external listings. Pure.
//
// Identity (provider id or canonical URL) decides whether two imports are the SAME listing and is enforced atomically
// in the database. Similarity is only advice for the reviewer: it flags listings that LOOK alike so a person can
// decide. It never merges, never overwrites a publisher's content, and never treats two different roles at the same
// employer as one: the role title has to be close, the employer alone is not enough.

import { canonicalizeUrl, identityKey } from "./canonical.ts";
import type { ExternalDraft } from "./extract.ts";

export interface KnownListing {
  id: string;
  title: string;
  original_publisher: string | null;
  location: string | null;
}

export interface PossibleDuplicate {
  id: string;
  score: number;
  reasons: string[];
  /** Absent for another external listing. "scouted": members already see this posting in their Scouted list. */
  lane?: "scouted";
  /** How many members see it under Scouted. A number only: which members is never stored with a listing. */
  count?: number;
}

const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "at", "we", "are", "is", "remote", "hiring", "job", "role", "position", "wanted"]);

export function tokens(text: string | null | undefined): string[] {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export const DUPLICATE_THRESHOLD = 0.8;

export function possibleDuplicates(draft: Pick<ExternalDraft, "title" | "original_publisher" | "location">, known: KnownListing[]): PossibleDuplicate[] {
  const out: PossibleDuplicate[] = [];
  const dt = tokens(draft.title);
  const dp = tokens(draft.original_publisher);
  for (const k of known) {
    const titleSim = jaccard(dt, tokens(k.title));
    if (titleSim < DUPLICATE_THRESHOLD) continue; // a different role is never a duplicate, whoever publishes it
    const publisherSim = dp.length && tokens(k.original_publisher).length ? jaccard(dp, tokens(k.original_publisher)) : null;
    if (publisherSim !== null && publisherSim < 0.5) continue; // the same title at another employer is another listing
    const reasons = [`title ${Math.round(titleSim * 100)}% alike`];
    if (publisherSim !== null) reasons.push(`same publisher (${Math.round(publisherSim * 100)}% alike)`);
    if (draft.location && k.location && jaccard(tokens(draft.location), tokens(k.location)) >= 0.5) reasons.push("same location");
    out.push({ id: k.id, score: Math.round(titleSim * 100) / 100, reasons });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/** What a member's Scouted list stores about a posting (the older scout feeds, one row per member). */
export interface ScoutedRow {
  target_user_id: string;
  title: string;
  company: string | null;
  location: string | null;
  source_url: string | null;
  apply_url: string | null;
}

/**
 * The same posting already shown under Scouted. Scouted rows are private to each member, so this returns ONE entry with a
 * member count, never a row or a member id. The same address (provider id or canonical URL) is certain; otherwise the
 * title has to be close and the publisher alike, exactly as for two external listings. Advice for the curator only: it
 * never merges, hides or blocks anything.
 */
export function scoutedOverlap(draft: Pick<ExternalDraft, "title" | "original_publisher" | "location">, canonical: string | null, rows: ScoutedRow[]): PossibleDuplicate | null {
  const ours = canonical ? identityKey(canonical) : null;
  const members = new Set<string>();
  let byAddress = false;
  let best = 0;
  for (const r of rows) {
    const urls = [r.source_url, r.apply_url].map((u) => canonicalizeUrl(u)).filter((u): u is string => !!u);
    if (ours && urls.some((u) => identityKey(u) === ours)) {
      members.add(r.target_user_id);
      byAddress = true;
      continue;
    }
    const hit = possibleDuplicates(draft, [{ id: r.target_user_id, title: r.title, original_publisher: r.company, location: r.location }])[0];
    if (hit) {
      members.add(r.target_user_id);
      best = Math.max(best, hit.score);
    }
  }
  if (members.size === 0) return null;
  const n = members.size;
  return {
    id: "scouted",
    lane: "scouted",
    count: n,
    score: byAddress ? 1 : best,
    reasons: [byAddress ? "same address" : "same title and publisher", `shown to ${n} member${n === 1 ? "" : "s"}`],
  };
}
