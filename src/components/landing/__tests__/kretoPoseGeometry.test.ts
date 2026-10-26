import { describe, expect, it } from "vitest";
import { BOTTOM_HELMET_WIDTH, BOTTOM_LEDGE, BOTTOM_SCALE, FLYING_HELMET_WIDTH, SIDE_HELMET_WIDTH, SIDE_SCALE, ledgeSlideSpan } from "../kretopia/kretoPoseGeometry";

describe("Kreto pose sizing and emergence", () => {
  it('matches Side Hidden helmet to Flying instead of shrinking the entire mascot', () => {
    expect(SIDE_SCALE).toBeGreaterThan(1);
    expect(SIDE_HELMET_WIDTH * SIDE_SCALE).toBeCloseTo(693, 8);
  });
  it("matches the hanging helmet exactly to Flying at every rendered size", () => {
    for (const box of [104, 180, 300]) {
      expect(BOTTOM_HELMET_WIDTH * BOTTOM_SCALE * box / 1024).toBeCloseTo(693 * box / 1024, 8);
    }
    expect(FLYING_HELMET_WIDTH).toBe(693);
  });
  it("keeps the hanging glove contact anchored after enlargement", () => {
    expect(BOTTOM_LEDGE).toBeCloseTo(350 / 1024 * (693 / 365), 8);
  });
  it("extends scroll emergence to 180px and preserves holds in shorter visits", () => {
    expect(ledgeSlideSpan(100, 700, 1300)).toBe(180);
    expect(ledgeSlideSpan(100, 250, 550)).toBe(50);
  });
});