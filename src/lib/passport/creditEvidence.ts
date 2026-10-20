/**
 * Shared credit evidence classification — the ONE place that decides how a
 * credit reads, on the Passport AND in Credits, so the same credit can never
 * be "Verified" in one and "Pending" in the other:
 *
 *   self_claimed  Self-declared: the creator added it; nothing independent backs it yet.
 *   co_signed     Co-signed: collaborators who worked on it vouch for it.
 *   pending       Pending: a confirmation or review is under way and does not count yet.
 *   verified      Verified: confirmed by an authoritative source or Kretopia's verification.
 *   publicly_sourced  Found in public records and claimed by the creator; not independently verified.
 *
 * Only a credit's own proof fields decide this (verification_status and the
 * number of collaborators who co-signed). A subscription, a payment, a plan,
 * an approval of the page or a profile score never turns a credit into proof,
 * so none of them is even an input here.
 */

export type CreditEvidenceStatus = "verified" | "co_signed" | "publicly_sourced" | "pending" | "self_claimed";

export interface EvidenceInput {
  verification_status?: string | null;
  endorsement_count?: number | null;
  /** Result of Kreto's public-source check, 0 to 1. It never changes the status; it is only mentioned beside it. */
  ai_confidence?: number | null;
}

const EVIDENCE_LABEL: Record<CreditEvidenceStatus, string> = {
  verified: "Verified",
  co_signed: "Co-signed",
  publicly_sourced: "Publicly sourced",
  pending: "Pending",
  self_claimed: "Self-declared",
};

const EVIDENCE_MEANING: Record<CreditEvidenceStatus, string> = {
  verified: "Confirmed by someone other than its owner: the relevant collaborator or client, the platform it comes from, or Kretopia's own record of the work.",
  co_signed: "Collaborators who worked on it vouch for it. Not yet verified by an authoritative source.",
  publicly_sourced: "Found in public records and claimed by its owner. Not independently verified.",
  pending: "A confirmation or review is under way. It does not count as proof yet.",
  self_claimed: "Added by its owner. Nothing independent confirms it yet.",
};

/**
 * The four words a reader meets on a credit, in the order of how much they prove, with what each one means.
 * The Verified sentence is the owner's; the last part is true to the data: credits Kretopia records itself or
 * imports from a platform are marked Verified too, and every credit says which basis it has.
 */
export const VERIFICATION_LEGEND: ReadonlyArray<{ key: "self_claimed" | "co_signed" | "ai_checked" | "verified"; label: string; meaning: string }> = [
  { key: "self_claimed", label: "Self-declared", meaning: "Added by its owner. Nothing independent confirms it yet." },
  { key: "co_signed", label: "Co-signed", meaning: "A collaborator who worked on it vouches for it. It is not Verified until it is confirmed." },
  { key: "ai_checked", label: "AI-checked", meaning: "Kreto searched public sources for signs of it. That is a lead, never proof and never 100% certain, and it does not make a credit Verified on its own." },
  { key: "verified", label: "Verified", meaning: "Verified means the contribution was confirmed by the relevant collaborator or client. Credits Kretopia records itself or finds on a platform such as YouTube or IMDb are marked Verified too, and each credit shows which basis it has." },
];

/** What Kreto's public-source check found, in plain words, or null when it never ran. Never a claim of certainty. */
export function aiCheckNote(aiConfidence: number | null | undefined): string | null {
  if (typeof aiConfidence !== "number" || !Number.isFinite(aiConfidence)) return null;
  if (aiConfidence >= 0.7) return "AI-checked: possible public evidence found (not proof)";
  if (aiConfidence < 0.3) return "AI-checked: no public evidence found";
  return "AI-checked: inconclusive";
}

export function classifyCreditEvidence(credit: EvidenceInput): CreditEvidenceStatus {
  const verificationStatus = credit.verification_status ?? "unverified";
  const endorsementCount = credit.endorsement_count || 0;
  const isVerified = verificationStatus === "verified";
  const isPending = verificationStatus === "pending" || verificationStatus === "pending_review";
  const hasPeers = endorsementCount > 0;

  if (isVerified) return "verified";
  if (verificationStatus === "auto_discovered") return "publicly_sourced";
  // A review under way outranks the co-signs already received: until it is done the credit does not count.
  if (isPending) return "pending";
  if (hasPeers) return "co_signed";
  return "self_claimed";
}

export function creditEvidenceLabel(status: CreditEvidenceStatus): string {
  return EVIDENCE_LABEL[status];
}

/**
 * What the owner can do next to strengthen a credit, from its status and whether it has evidence attached
 * (a link or a file). null when there is nothing for them to do: verified, or co-signed and in good standing.
 */
export function creditNextStep(status: CreditEvidenceStatus, hasEvidence: boolean): string | null {
  if (status === "self_claimed") return hasEvidence ? "Ask a collaborator to co-sign it." : "Add a link or a file as evidence.";
  if (status === "publicly_sourced") return "Ask a collaborator to co-sign it.";
  if (status === "pending") return "Waiting on a reply or a review.";
  return null;
}

/** One plain sentence saying what the status does and does not prove. */
export function creditEvidenceMeaning(status: CreditEvidenceStatus): string {
  return EVIDENCE_MEANING[status];
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
  const ai = aiCheckNote(credit.ai_confidence);
  const withAi = (basis: string) => (ai ? `${basis} · ${ai}` : basis);
  if (status === "publicly_sourced") return withAi("Found in public records");
  if (status === "co_signed") return withAi(`Co-signed by ${peers} collaborator${peers === 1 ? "" : "s"}`);
  if (status === "pending") return withAi("Awaiting confirmation");
  return withAi("Self-declared");
}
