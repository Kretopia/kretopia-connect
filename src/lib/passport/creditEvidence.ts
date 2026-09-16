/**
 * Shared credit evidence classification — the ONE place that decides
 * whether a credit reads as Verified / Publicly Sourced / Pending /
 * Self-claimed. Extracted from AchievementCard's inline logic so the
 * Stamps grid and the Co-Signs carousels can never drift out of sync
 * on what "Verified" actually means.
 */

export type CreditEvidenceStatus = "verified" | "publicly_sourced" | "pending" | "self_claimed";

export interface EvidenceInput {
  verification_status?: string | null;
  endorsement_count?: number | null;
}

const EVIDENCE_LABEL: Record<CreditEvidenceStatus, string> = {
  verified: "Verified",
  publicly_sourced: "Publicly Sourced",
  pending: "Pending",
  self_claimed: "Self-claimed",
};

export function classifyCreditEvidence(credit: EvidenceInput): CreditEvidenceStatus {
  const verificationStatus = credit.verification_status ?? "unverified";
  const endorsementCount = credit.endorsement_count || 0;
  const isVerified = verificationStatus === "verified";
  const isPending = verificationStatus === "pending" || verificationStatus === "pending_review";
  const hasPeers = endorsementCount > 0;

  if (isVerified) return "verified";
  if (verificationStatus === "auto_discovered") return "publicly_sourced";
  if (hasPeers || isPending) return "pending";
  return "self_claimed";
}

export function creditEvidenceLabel(status: CreditEvidenceStatus): string {
  return EVIDENCE_LABEL[status];
}
