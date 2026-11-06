import { describe, expect, it } from "vitest";
import { passportStrength } from "../strength";

const base = { hasBio: false, hasAvatar: false, totalCredits: 0, verifiedCredits: 0, cosigns: 0 };

describe("passportStrength", () => {
  it("starts at zero for an empty Passport", () => {
    expect(passportStrength(base)).toBe(0);
  });

  it("weighs a bio (20) and a photo (15)", () => {
    expect(passportStrength({ ...base, hasBio: true })).toBe(20);
    expect(passportStrength({ ...base, hasAvatar: true })).toBe(15);
  });

  it("counts credits up to five (6 each), verified ones up to three (10 each) and one co-sign (5)", () => {
    expect(passportStrength({ ...base, totalCredits: 2 })).toBe(12);
    expect(passportStrength({ ...base, totalCredits: 9 })).toBe(30);
    expect(passportStrength({ ...base, verifiedCredits: 2 })).toBe(20);
    expect(passportStrength({ ...base, verifiedCredits: 7 })).toBe(30);
    expect(passportStrength({ ...base, cosigns: 1 })).toBe(5);
    expect(passportStrength({ ...base, cosigns: 40 })).toBe(5);
  });

  it("tops out at exactly 100", () => {
    expect(passportStrength({ hasBio: true, hasAvatar: true, totalCredits: 50, verifiedCredits: 50, cosigns: 50 })).toBe(100);
  });

  it("is the number the owner card showed before: bio + photo + 3 credits (1 verified) + 1 co-sign = 68", () => {
    expect(passportStrength({ hasBio: true, hasAvatar: true, totalCredits: 3, verifiedCredits: 1, cosigns: 1 })).toBe(20 + 15 + 18 + 10 + 5);
  });

  it("ignores counts that are not real numbers rather than showing NaN", () => {
    expect(passportStrength({ ...base, totalCredits: Number.NaN, verifiedCredits: -4, cosigns: Number.POSITIVE_INFINITY })).toBe(0);
  });
});
