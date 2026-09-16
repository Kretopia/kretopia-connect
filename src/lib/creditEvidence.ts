/**
 * Evidence-state derivation for credits — grounded in the real fields on
 * `public.credits` (verification_status, verification_url,
 * endorsement_count, verified_by_name/verified_by_user_id). Never invents
 * a tier the data doesn't support: a credit only reaches "Organization
 * Confirmed" or "Co-Signed" if the corresponding real field says so.
 *
 * "Verified Credit" is the product term; "Passport Stamp" is the visual
 * metaphor for the same thing once it's fully confirmed.
 */

export type EvidenceState =
  | "claimed"
  | "publicly_sourced"
  | "evidence_backed"
  | "co_signed"
  | "organization_confirmed"
  | "pending_review";

export const EVIDENCE_STATE_LABEL: Record<EvidenceState, string> = {
  claimed: "Claimed",
  publicly_sourced: "Publicly Sourced",
  evidence_backed: "Evidence-backed",
  co_signed: "Co-Signed",
  organization_confirmed: "Organization Confirmed",
  pending_review: "Pending Review",
};

export const EVIDENCE_STATE_DESCRIPTION: Record<EvidenceState, string> = {
  claimed: "Self-reported. Not yet backed by a link, a co-sign, or an organization.",
  publicly_sourced: "Found from a public source (e.g. a streaming or listing platform), not self-claimed.",
  evidence_backed: "Backed by a link to the original credit — a listing, article, or release page.",
  co_signed: "Confirmed by a collaborator who worked on it with you.",
  organization_confirmed: "Confirmed by the organization or platform of record.",
  pending_review: "Submitted and waiting on review before it counts toward your Passport.",
};

export interface CreditEvidenceInput {
  verification_status: string | null;
  verification_url?: string | null;
  endorsement_count?: number | null;
  verified_by_name?: string | null;
  verified_by_user_id?: string | null;
  source?: string | null;
}

const PENDING_STATUSES = new Set(["pending", "pending_review"]);
const PUBLICLY_SOURCED_STATUSES = new Set(["auto_discovered", "ai_imported"]);
const ORG_STATUSES = new Set(["manual", "enterprise", "imported"]);

/**
 * Deterministic, data-only mapping — no inference beyond what the row
 * actually contains. Order of checks matters: pending overrides tier
 * position (it's a waiting state, not a rung), organization/co-sign
 * checks come before weaker evidence so a fully-confirmed credit is
 * never under-reported.
 */
export function deriveEvidenceState(credit: CreditEvidenceInput): EvidenceState {
  const status = (credit.verification_status || "").toLowerCase();

  if (PENDING_STATUSES.has(status)) return "pending_review";

  if (status === "verified" && (credit.verified_by_name || credit.verified_by_user_id)) {
    return "organization_confirmed";
  }
  if (ORG_STATUSES.has(status)) return "organization_confirmed";

  if ((credit.endorsement_count ?? 0) > 0) return "co_signed";

  if (credit.verification_url) return "evidence_backed";

  if (PUBLICLY_SOURCED_STATUSES.has(status)) return "publicly_sourced";

  return "claimed";
}

export const EVIDENCE_STATE_ORDER: EvidenceState[] = [
  "claimed",
  "publicly_sourced",
  "evidence_backed",
  "co_signed",
  "organization_confirmed",
];
