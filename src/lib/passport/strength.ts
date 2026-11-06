/**
 * Passport Strength: the one progress number on the owner's Passport card, 0 to 100. These are the weights the owner card always used
 * (a bio, a photo, up to five credits, up to three verified ones, one co-sign), kept in one place now that the card is drawn by the
 * shared Passport document instead of by its own component.
 */
export interface PassportStrengthInput {
  hasBio: boolean;
  hasAvatar: boolean;
  totalCredits: number;
  verifiedCredits: number;
  /** Approved co-signs received. */
  cosigns: number;
}

const count = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function passportStrength({ hasBio, hasAvatar, totalCredits, verifiedCredits, cosigns }: PassportStrengthInput): number {
  return Math.round(
    (hasBio ? 20 : 0) +
    (hasAvatar ? 15 : 0) +
    Math.min(count(totalCredits), 5) * 6 +
    Math.min(count(verifiedCredits), 3) * 10 +
    Math.min(count(cosigns), 1) * 5,
  );
}
