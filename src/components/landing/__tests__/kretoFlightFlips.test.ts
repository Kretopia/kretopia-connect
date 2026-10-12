import { describe, expect, it } from "vitest";
import { flipAt, lockX, mediaLedgeLocks, mediaSideLocks, type Flip } from "../kretopia/kretoFlightPath";

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
  it("marks the approach and the release so the grip pose only shows at the far end of each", () => {
    expect(locks[0].phase).toBe("arrive");
    expect(locks[locks.length - 1].phase).toBe("depart");
    expect(locks.slice(1, -1).every((l) => l.phase === undefined)).toBe(true);
  });
});

describe("mediaSideLocks: one horizontal reveal", () => {
  const locks = mediaSideLocks({
    topAt: 1000, release: 2000, slide: 100, reveal: 200,
    flyX: 90, hiddenX: 300, arriveY: 100, sideY1: 400, sideY2: 800, departY: 1200, side: "left", scale: 0.7,
  });

  it("is five contiguous locks that join in x and in y", () => {
    expect(locks).toHaveLength(5);
    for (let i = 1; i < locks.length; i++) {
      expect(locks[i].from).toBe(locks[i - 1].to);
      expect(locks[i].x).toBe(locks[i - 1].x2 ?? locks[i - 1].x);
      expect(locks[i].y).toBe(locks[i - 1].y2 ?? locks[i - 1].y);
    }
    expect(locks[4].y2).toBe(1200);
    expect(locks[4].x2).toBe(90);
  });

  it("goes behind the edge first, comes out once, and grips only at the maximum", () => {
    expect(locks[0].x2).toBe(300);
    expect(locks[1].x).toBe(300);
    expect(locks[1].x2).toBe(90);
    expect(locks.map((l) => !!l.grip)).toEqual([false, false, true, false, false]);
    expect(locks[2].x2).toBeUndefined();
  });

  it("carries the side, the fit and the phases the pose swap waits on", () => {
    expect(locks.every((l) => l.pose === "peekSide" && l.side === "left" && l.scale === 0.7)).toBe(true);
    expect(locks[0].phase).toBe("arrive");
    expect(locks[4].phase).toBe("depart");
    expect(locks.slice(1, 4).every((l) => l.phase === undefined)).toBe(true);
  });
});

describe("lockX", () => {
  it("eases across a lock and holds its ends", () => {
    const lock = { from: 100, to: 300, x: 10, x2: 110, y: 0, pose: "peekSide" as const };
    expect(lockX(lock, 50)).toBe(10);
    expect(lockX(lock, 200)).toBeCloseTo(60, 5);
    expect(lockX(lock, 400)).toBe(110);
    expect(lockX({ ...lock, x2: undefined }, 200)).toBe(10);
  });
});

describe("mediaLedgeLocks: a targeted way across", () => {
  const locks = mediaLedgeLocks({
    topAt: 1000, middle: 1500, release: 2000, slide: 80, x: 40, xBottom: 640,
    arriveY: 100, topY: 160, hiddenTop: 220, hiddenBottom: 700, bottomY: 640, departY: 900,
  });

  it("moves sideways only while he sinks behind the media, and leaves from the bottom x", () => {
    expect(locks[0].x).toBe(40);
    expect(locks[1].x).toBe(40);
    expect(locks[2].x).toBe(40);
    expect(locks[2].x2).toBe(640);
    expect(locks.slice(3).every((l) => l.x === 640 && l.x2 === undefined)).toBe(true);
  });

  it("is a straight drop when no bottom x is given", () => {
    const plain = mediaLedgeLocks({
      topAt: 1000, middle: 1500, release: 2000, slide: 80, x: 40,
      arriveY: 100, topY: 160, hiddenTop: 220, hiddenBottom: 700, bottomY: 640, departY: 900,
    });
    expect(plain.every((l) => l.x === 40)).toBe(true);
  });
});
