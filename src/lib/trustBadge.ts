/**
 * One rule for trust markers: when a subject (a credit, a profile) holds several trust states, only the strongest is shown.
 *
 *   Verified  >  Vouched
 *
 * "Verified" is confirmed by an authoritative source or Kretopia; "Vouched" is a collaborator's word (a co-sign, an endorsement). They never
 * appear as two competing badges on one surface. The weaker state stays in the data: nothing is deleted, it is only not drawn.
 * Every surface decides through this module, so the order is stated once.
 */
export type TrustState = "verified" | "vouched";

/** Strongest first. The one place the order is written. */
export const TRUST_ORDER: readonly TrustState[] = ["verified", "vouched"];

export interface TrustFacts {
  verified?: boolean | null;
  /** Collaborators who vouch (co-signs, endorsements). */
  vouchCount?: number | null;
}

/** Every state the subject holds, strongest first. This is the data; it is not what a surface draws. */
export function heldTrustStates(facts: TrustFacts): TrustState[] {
  const held: Record<TrustState, boolean> = { verified: !!facts.verified, vouched: (facts.vouchCount ?? 0) > 0 };
  return TRUST_ORDER.filter((state) => held[state]);
}

export interface StrongestTrust {
  state: TrustState;
  /** Kept for the label of "vouched"; 0 for "verified". */
  vouchCount: number;
}

/** The one state to draw, or null when the subject holds none. */
export function strongestTrust(facts: TrustFacts): StrongestTrust | null {
  const [state] = heldTrustStates(facts);
  if (!state) return null;
  return { state, vouchCount: state === "vouched" ? Math.max(0, Math.floor(facts.vouchCount ?? 0)) : 0 };
}

export const TRUST_LABEL: Record<TrustState, string> = { verified: "Verified", vouched: "Vouched" };

export function trustLabel(trust: StrongestTrust): string {
  return trust.state === "vouched" && trust.vouchCount > 0 ? `${TRUST_LABEL.vouched} · ${trust.vouchCount}` : TRUST_LABEL[trust.state];
}

export const TRUST_MEANING: Record<TrustState, string> = {
  verified: "Confirmed by an authoritative source or by Kretopia's own record of the work.",
  vouched: "Collaborators who worked on it vouch for it. Not yet verified by an authoritative source.",
};
