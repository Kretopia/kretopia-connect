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

const PLATFORM_SOURCE_LABEL: Record<string, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  imdb: "IMDb",
  "imdb.com": "IMDb",
  discogs: "Discogs",
  musicbrainz: "MusicBrainz",
};

/**
 * A reader weighing a hire needs to know WHY a credit counts as verified, not
 * just that it does: a collaborator confirming it, a platform account, or a
 * Kretopia review are three different strengths of evidence. Every non-verified
 * state says plainly what it is, so none can pass for a confirmed credit.
 */
export function creditEvidenceBasis(credit: EvidenceInput & { source?: string | null }): string {
  const status = classifyCreditEvidence(credit);
  const peers = credit.endorsement_count || 0;
  if (status === "verified") {
    if (peers > 0) return `Confirmed by ${peers} collaborator${peers === 1 ? "" : "s"}`;
    const platform = PLATFORM_SOURCE_LABEL[(credit.source || "").toLowerCase()];
    return platform ? `Verified on ${platform}` : "Verified by Kretopia";
  }
  if (status === "publicly_sourced") return "Found in public records";
  if (status === "pending") return "Awaiting confirmation";
  return "Self-claimed";
}
