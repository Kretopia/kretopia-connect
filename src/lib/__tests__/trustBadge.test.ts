import { describe, expect, it } from "vitest";
import { heldTrustStates, strongestTrust, trustLabel, TRUST_ORDER } from "@/lib/trustBadge";

describe("trust badge rule: Verified > Vouched", () => {
  it("states the order once, strongest first", () => {
    expect(TRUST_ORDER).toEqual(["verified", "vouched"]);
  });

  it("shows only Verified when a subject is both verified and vouched, and keeps both in the data", () => {
    const facts = { verified: true, vouchCount: 4 };
    expect(strongestTrust(facts)).toEqual({ state: "verified", vouchCount: 0 });
    expect(heldTrustStates(facts)).toEqual(["verified", "vouched"]);
  });

  it("shows Vouched, with its count, when that is all there is", () => {
    const trust = strongestTrust({ verified: false, vouchCount: 3 })!;
    expect(trust.state).toBe("vouched");
    expect(trustLabel(trust)).toBe("Vouched · 3");
  });

  it.each([
    [{}, null],
    [{ verified: false, vouchCount: 0 }, null],
    [{ verified: null, vouchCount: null }, null],
    [{ verified: false, vouchCount: -2 }, null],
  ])("shows nothing for %j", (facts, expected) => {
    expect(strongestTrust(facts)).toBe(expected);
  });

  it("never lets a count of vouches outrank verification, however large", () => {
    expect(strongestTrust({ verified: true, vouchCount: 10_000 })!.state).toBe("verified");
  });
});
