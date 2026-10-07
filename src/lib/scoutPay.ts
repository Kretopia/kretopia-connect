// Scouted listings sometimes store a placeholder string instead of leaving
// compensation null — don't surface those as if they were real information.
const PLACEHOLDER_COMPENSATION = /^(not specified|unspecified|n\/?a|tbd|none|unknown|-)$/i;

export const hasRealCompensation = (comp: string | null | undefined): comp is string => {
  const v = comp?.trim();
  return !!v && !PLACEHOLDER_COMPENSATION.test(v);
};

export type PayFilter = "all" | "paid";

/**
 * Pay filter for the Scout feed. "paid" keeps only listings that state their
 * compensation; the original (fit-score) order is preserved either way, so a
 * high-fit listing is never reshuffled below a lower-fit one by the filter.
 */
export function applyPayFilter<T extends { compensation: string | null }>(gigs: T[], filter: PayFilter): T[] {
  return filter === "paid" ? gigs.filter((g) => hasRealCompensation(g.compensation)) : gigs;
}

export function countPaid<T extends { compensation: string | null }>(gigs: T[]): number {
  return gigs.reduce((n, g) => n + (hasRealCompensation(g.compensation) ? 1 : 0), 0);
}
