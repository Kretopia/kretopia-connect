import { classifyCreditEvidence, creditEvidenceBasis, type CreditEvidenceStatus } from "./creditEvidence";

/**
 * "Can someone understand this person's experience and contribution well
 * enough to consider hiring them?" -- derived only from what the Passport
 * actually holds. Nothing is estimated: a missing year stays missing (no
 * "years of experience" is invented), and counts come from the database, not
 * from however many rows the page happened to load.
 */

export interface GlanceCreditInput {
  id: string;
  project_name?: string | null;
  title?: string | null;
  role?: string | null;
  year?: number | null;
  source?: string | null;
  verification_status?: string | null;
  endorsement_count?: number | null;
  /** Set for credits that come from a project record rather than the credits table. */
  forcedEvidence?: CreditEvidenceStatus;
  forcedBasis?: string;
}

export interface GlanceProof {
  id: string;
  project: string;
  role: string;
  year: number | null;
  evidence: CreditEvidenceStatus;
  basis: string;
}

export interface HiringGlance {
  /** Earliest dated credit; null when none of the credits carries a year. */
  sinceYear: number | null;
  yearsActive: number | null;
  total: number;
  confirmed: number;
  confirmedShare: number;
  topRoles: { role: string; count: number }[];
  /** True when topRoles/proof come from a subset of the record (only the newest credits are loaded). */
  partial: boolean;
  proof: GlanceProof[];
}

export interface GlanceCounts {
  total?: number | null;
  confirmed?: number | null;
  earliestYear?: number | null;
}

const MAX_PROOF = 3;
const MAX_ROLES = 3;

const normRole = (role: string) => role.trim().replace(/\s+/g, " ");

export function buildHiringGlance(credits: GlanceCreditInput[], counts: GlanceCounts = {}, now: Date = new Date()): HiringGlance {
  const rows = credits.map((c) => {
    const evidence = c.forcedEvidence ?? classifyCreditEvidence(c);
    const basis = c.forcedBasis ?? creditEvidenceBasis(c);
    return { c, evidence, basis };
  });

  const loadedConfirmed = rows.filter((r) => r.evidence === "verified").length;
  // Database counts win: the page only loads the newest handful of credits.
  const total = Math.max(counts.total ?? 0, rows.length);
  const confirmed = Math.min(Math.max(counts.confirmed ?? 0, loadedConfirmed), total);

  const years = rows.map((r) => r.c.year).filter((y): y is number => typeof y === "number" && y > 1900);
  const earliestCandidates = [...years, ...(counts.earliestYear && counts.earliestYear > 1900 ? [counts.earliestYear] : [])];
  const sinceYear = earliestCandidates.length ? Math.min(...earliestCandidates) : null;
  const thisYear = now.getFullYear();
  // Elapsed years since the first dated credit (0 = the first one is from this year).
  const yearsActive = sinceYear === null ? null : Math.max(0, thisYear - sinceYear);

  const roleCounts = new Map<string, { role: string; count: number }>();
  for (const { c } of rows) {
    const role = c.role ? normRole(c.role) : "";
    if (!role) continue;
    const key = role.toLowerCase();
    const prev = roleCounts.get(key);
    roleCounts.set(key, { role: prev?.role ?? role, count: (prev?.count ?? 0) + 1 });
  }
  const topRoles = [...roleCounts.values()].sort((a, b) => b.count - a.count || a.role.localeCompare(b.role)).slice(0, MAX_ROLES);

  const rank: Record<CreditEvidenceStatus, number> = { verified: 0, publicly_sourced: 1, pending: 2, self_claimed: 3 };
  const proof = rows
    .filter((r) => (r.c.project_name || r.c.title) && r.c.role)
    .sort((a, b) => rank[a.evidence] - rank[b.evidence] || (b.c.year ?? 0) - (a.c.year ?? 0))
    .slice(0, MAX_PROOF)
    .map(({ c, evidence, basis }) => ({
      id: c.id,
      project: (c.project_name || c.title) as string,
      role: normRole(c.role as string),
      year: c.year ?? null,
      evidence,
      basis,
    }));

  return {
    sinceYear,
    yearsActive,
    total,
    confirmed,
    confirmedShare: total > 0 ? confirmed / total : 0,
    topRoles,
    partial: total > rows.length,
    proof,
  };
}
