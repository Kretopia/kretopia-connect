import { describe, expect, it } from "vitest";
import { flipAt, mediaLedgeLocks, type Flip } from "../kretopia/kretoFlightPath";

const flips: Flip[] = [
  { from: 100, to: 300, kind: "backflip" },
  { from: 800, to: 1000, kind: "spin" },
];

describe("flipAt", () => {
  it("is undefined outside every flip", () => {
    expect(flipAt(flips, 50)).toBeUndefined();
    expect(flipAt(flips, 500)).toBeUndefined();
  });

  it("eases from 0 to 1 across the flip, the same on the way back up", () => {
    expect(flipAt(flips, 100)).toEqual({ kind: "backflip", t: 0 });
    expect(flipAt(flips, 300)).toEqual({ kind: "backflip", t: 1 });
    const mid = flipAt(flips, 200)!;
    expect(mid.t).toBeCloseTo(0.5, 5);
    expect(flipAt(flips, 200)).toEqual(mid);
  });

  it("picks the right kind", () => {
    expect(flipAt(flips, 900)?.kind).toBe("spin");
  });
});

describe("mediaLedgeLocks: sticky tuck", () => {
  const locks = mediaLedgeLocks({
    topAt: 1000, middle: 1500, release: 2000, slide: 80, x: 40,
    arriveY: 100, topY: 160, hiddenTop: 220, hiddenBottom: 700, bottomY: 640, departY: 900,
  });

  it("gives each resting ledge lock the tucked height it returns to while the page scrolls", () => {
    const top = locks.find((l) => l.pose === "peekTop" && l.y2 === undefined)!;
    const bottom = locks.find((l) => l.pose === "peekBottom" && l.y2 === undefined)!;
    expect(top.y).toBe(160);
    expect(top.hidden).toBe(220);
    expect(bottom.y).toBe(640);
    expect(bottom.hidden).toBe(700);
  });

  it("leaves the sliding transition locks without a hidden height", () => {
    expect(locks.filter((l) => l.y2 !== undefined).every((l) => l.hidden === undefined)).toBe(true);
  });
});
