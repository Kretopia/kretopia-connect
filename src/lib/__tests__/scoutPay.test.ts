import { describe, expect, it } from "vitest";
import { applyPayFilter, countPaid, hasRealCompensation } from "../scoutPay";

const gig = (id: string, compensation: string | null) => ({ id, compensation });

describe("scoutPay", () => {
  it("treats placeholder strings and blanks as no compensation", () => {
    for (const v of [null, undefined, "", "   ", "Not specified", "n/a", "TBD", "unknown", "-", "None"]) {
      expect(hasRealCompensation(v)).toBe(false);
    }
  });

  it("keeps real figures and ranges", () => {
    expect(hasRealCompensation("$500/day")).toBe(true);
    expect(hasRealCompensation("£30–40k")).toBe(true);
    expect(hasRealCompensation("Paid, rate on request")).toBe(true);
  });

  it("filters to paid listings without reordering them", () => {
    const gigs = [gig("a", "$100/hr"), gig("b", null), gig("c", "TBD"), gig("d", "$2k flat")];
    expect(applyPayFilter(gigs, "paid").map((g) => g.id)).toEqual(["a", "d"]);
    expect(applyPayFilter(gigs, "all")).toBe(gigs);
    expect(countPaid(gigs)).toBe(2);
  });
});
