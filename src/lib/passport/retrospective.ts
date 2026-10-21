// "Your year on Kretopia": what a creative actually did in a period, from records that exist, with the counting
// rules written down. Nothing here ranks, compares or projects: no percentile, no growth rate, no "top N%".
//
// Period: one calendar year in UTC, half-open, [1 January 00:00:00.000Z, next 1 January 00:00:00.000Z). A moment
// exactly at the next 1 January belongs to the next year. The local time zone is not used, so someone who adds a
// credit late on 31 December west of UTC may see it counted in the next year. The current year is "so far".
//
// What is counted, and by which date:
//   - credits: records of work on the Passport (source other than `portfolio`) by `created_at`, the day they were
//     added to Kretopia, NOT the year of the work. They include credits imported from public sources, so the card
//     says "added to your Passport", never "earned". How well each is evidenced is the classifier's answer as of
//     TODAY, because the data keeps no date for when a credit became verified.
//   - co-signs received / given: `credit_endorsements` accepted in the period, by `responded_at`.
//   - pieces of media: `portfolio` credits by `created_at`, split into video and audio by their saved media type.
// Not used, because the data cannot support them for a period: view counts (cumulative), collaborator lists
// (other people), and any score. A fact with a count of zero is simply absent.

import { classifyCreditEvidence, type CreditEvidenceStatus } from "./creditEvidence";

export interface RetroCredit {
  created_at?: string | null;
  source?: string | null;
  verification_status?: string | null;
  endorsement_count?: number | null;
  ai_confidence?: number | null;
  media_type?: string | null;
}

export interface RetroCoSign {
  /** When the co-sign was accepted. */
  responded_at?: string | null;
}

export interface RetroPeriod {
  year: number;
  /** Inclusive. */
  start: Date;
  /** Exclusive. */
  end: Date;
}

export interface RetroSummary {
  year: number;
  /** True for the current year: the numbers are "so far". */
  isPartial: boolean;
  credits: { added: number; byEvidence: Record<CreditEvidenceStatus, number>; backed: number };
  coSigns: { received: number; given: number };
  media: { video: number; audio: number; other: number; total: number };
  hasActivity: boolean;
}

export type RetroCardKind = "cover" | "credits" | "cosigns" | "media" | "closing";

export interface RetroCard {
  kind: RetroCardKind;
  /** Small caps line above the number. */
  kicker: string;
  /** The one big figure, or null on the cover and closing cards. */
  figure: number | null;
  headline: string;
  detail: string | null;
}

export function retroPeriod(year: number): RetroPeriod {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) throw new RangeError(`Invalid year: ${year}`);
  return { year, start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}

/** True when the ISO timestamp is in the period. An unreadable or missing date is never in it. */
export function inRetroPeriod(iso: string | null | undefined, period: RetroPeriod): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= period.start.getTime() && t < period.end.getTime();
}

const emptyEvidence = (): Record<CreditEvidenceStatus, number> => ({ verified: 0, co_signed: 0, publicly_sourced: 0, pending: 0, self_claimed: 0 });
const VIDEO = new Set(["video", "youtube", "vimeo"]);

export function summarizeRetrospective(input: {
  year: number;
  credits: readonly RetroCredit[];
  received: readonly RetroCoSign[];
  given: readonly RetroCoSign[];
  now?: Date;
}): RetroSummary {
  const period = retroPeriod(input.year);
  const now = input.now ?? new Date();
  const byEvidence = emptyEvidence();
  const media = { video: 0, audio: 0, other: 0, total: 0 };
  let added = 0;

  for (const credit of input.credits) {
    if (!inRetroPeriod(credit.created_at, period)) continue;
    if (credit.source === "portfolio") {
      const type = (credit.media_type ?? "").trim().toLowerCase();
      media.total += 1;
      if (VIDEO.has(type)) media.video += 1;
      else if (type === "audio") media.audio += 1;
      else media.other += 1;
    } else {
      added += 1;
      byEvidence[classifyCreditEvidence(credit)] += 1;
    }
  }

  const received = input.received.filter((c) => inRetroPeriod(c.responded_at, period)).length;
  const given = input.given.filter((c) => inRetroPeriod(c.responded_at, period)).length;
  const summary: RetroSummary = {
    year: input.year,
    isPartial: input.year === now.getUTCFullYear(),
    credits: { added, byEvidence, backed: byEvidence.verified + byEvidence.co_signed },
    coSigns: { received, given },
    media,
    hasActivity: added > 0 || received > 0 || given > 0 || media.total > 0,
  };
  return summary;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The cards worth showing, in order. Cover and closing always exist; the rest only when there is something to say. */
export function retrospectiveCards(summary: RetroSummary, name: string): RetroCard[] {
  const label = summary.isPartial ? `${summary.year} so far` : String(summary.year);
  const cards: RetroCard[] = [{ kind: "cover", kicker: "Your year on Kretopia", figure: null, headline: label, detail: name || null }];

  if (summary.credits.added > 0) {
    const { added, backed } = summary.credits;
    cards.push({
      kind: "credits",
      kicker: label,
      figure: added,
      headline: added === 1 ? "credit added to your Passport" : "credits added to your Passport",
      detail: backed > 0 ? `${backed === added ? "All" : backed} of them verified or co-signed` : null,
    });
  }

  const { received, given } = summary.coSigns;
  if (received > 0 || given > 0) {
    cards.push({
      kind: "cosigns",
      kicker: label,
      figure: received > 0 ? received : given,
      headline: received > 0 ? (received === 1 ? "co-sign received" : "co-signs received") : given === 1 ? "co-sign given" : "co-signs given",
      detail: received > 0 && given > 0 ? `and ${given} given to people you worked with` : null,
    });
  }

  if (summary.media.total > 0) {
    const parts = [
      summary.media.video > 0 ? plural(summary.media.video, "video", "videos") : null,
      summary.media.audio > 0 ? plural(summary.media.audio, "audio piece", "audio pieces") : null,
      summary.media.other > 0 ? plural(summary.media.other, "image or other piece", "images or other pieces") : null,
    ].filter(Boolean);
    cards.push({
      kind: "media",
      kicker: label,
      figure: summary.media.total,
      headline: summary.media.total === 1 ? "piece of work added" : "pieces of work added",
      detail: parts.join(", "),
    });
  }

  cards.push({ kind: "closing", kicker: "Creative Passport", figure: null, headline: "See the work behind the numbers", detail: name || null });
  return cards;
}

/** Years worth offering: from the earliest recorded activity to now, newest first; the current year is always there. */
export function retroYears(earliestIso: string | null | undefined, now: Date = new Date()): number[] {
  const current = now.getUTCFullYear();
  const t = earliestIso ? Date.parse(earliestIso) : NaN;
  const first = Number.isFinite(t) ? Math.min(new Date(t).getUTCFullYear(), current) : current;
  const years: number[] = [];
  for (let y = current; y >= first; y--) years.push(y);
  return years;
}

/** What a screen reader hears for a card drawn on a canvas: the same words the picture shows. */
export function describeCard(card: RetroCard): string {
  return [card.kicker, card.figure !== null ? String(card.figure) : null, card.headline, card.detail].filter(Boolean).join(". ");
}
