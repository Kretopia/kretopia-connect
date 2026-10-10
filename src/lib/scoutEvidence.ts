/**
 * What Scout may say about why a gig is on someone's list.
 *
 * The scan stores one sentence per gig in `fit_reason`. The keyword engine
 * writes it from real matches ("Matches your “motion design” · Remote · posted
 * yesterday · $60k / year."); the web-search path keeps the model's own wording
 * and appends "Posted 2 days ago". Two things in that sentence stop being true
 * after the scan: the relative dates ("yesterday", "2 days ago") and nothing
 * else. So they are dropped here, and the card shows its own live date. Pay is
 * dropped as well because every card has a pay chip.
 *
 * Nothing is added: no score, no superlative, no "strongest".
 */

/** Rows written by the keyword engine are matched against the Passport by code; every other source is model-written text. */
const ENGINE_SOURCE = "gigboard";

const MAX_LINES = 4;

const RELATIVE_WHEN = /\b(?:\d+|an?)\s+(?:minute|hour|day|week|month)s?\s+ago\b/i;

const isStaleWhen = (segment: string): boolean =>
  /^posted\b/i.test(segment) || /^(?:just now|today|yesterday)$/i.test(segment) || RELATIVE_WHEN.test(segment);

export interface ScoutEvidenceInput {
  fit_reason: string | null | undefined;
  compensation?: string | null;
  source?: string | null;
}

export interface ScoutEvidence {
  /** Short factual statements, in the order the scan wrote them. */
  lines: string[];
  /** True when the sentence was written by a model from the listing rather than matched by code. */
  summarised: boolean;
}

/** The evidence lines worth showing for a gig, or null when nothing durable is left. */
export function scoutEvidence({ fit_reason, compensation, source }: ScoutEvidenceInput): ScoutEvidence | null {
  const text = (fit_reason ?? "").trim();
  if (!text) return null;

  const pay = (compensation ?? "").trim().toLowerCase();
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const raw of text.split(/\s+·\s+/)) {
    const segment = raw.trim().replace(/[.\s]+$/, "");
    if (!segment) continue;
    if (isStaleWhen(segment)) continue;
    if (pay && segment.toLowerCase() === pay) continue;
    const key = segment.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(segment);
    if (lines.length === MAX_LINES) break;
  }

  if (lines.length === 0) return null;
  return { lines, summarised: (source ?? "") !== ENGINE_SOURCE };
}
