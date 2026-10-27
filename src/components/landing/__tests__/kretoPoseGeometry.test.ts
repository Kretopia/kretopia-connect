import { describe, expect, it } from "vitest";
import { BOTTOM_HELMET_WIDTH, BOTTOM_LEDGE, BOTTOM_SCALE, FLYING_HELMET_WIDTH, SIDE_HELMET_WIDTH, SIDE_MIN_ROOM, SIDE_SCALE, ledgeSlideSpan, planSideHide } from "../kretopia/kretoPoseGeometry";

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
describe("the side hide-and-seek plan", () => {
  // The chapters' real geometry at the widths people use: the media sits 108 / 48 px from its outer screen edge and
  // the chapter's text fills the other side.
  const chapter = (vw: number, outer: number, mediaWidth: number, mediaOnRight: boolean) => {
    const mediaLeft = mediaOnRight ? vw - outer - mediaWidth : outer;
    const mediaRight = mediaLeft + mediaWidth;
    const text = mediaOnRight ? { left: outer, right: mediaLeft - 40 } : { left: mediaRight + 40, right: vw - outer };
    return { vw, mediaLeft, mediaRight, text, size: vw >= 1440 ? 300 : 180, extent: 0.55 };
  };

  it("comes out of the outer edge, away from the text, on a media at either side", () => {
    expect(planSideHide(chapter(1440, 108, 687, true))?.side).toBe("right");
    expect(planSideHide(chapter(1440, 108, 687, false))?.side).toBe("left");
  });

  it("keeps Flying's size: the reach is the artwork's own, never shrunk to fit a narrow margin", () => {
    const plan = planSideHide(chapter(1440, 108, 687, true))!;
    expect(plan.full).toBeCloseTo(0.55 * 300 * SIDE_SCALE, 8);
    // In a 108 px margin only what fits comes out; the rest of him stays behind the media.
    expect(plan.reveal).toBe(108 - 8);
    expect(plan.reveal).toBeLessThan(plan.full);
  });

  it("comes out in full where the margin is wide enough", () => {
    const plan = planSideHide(chapter(1920, 348, 687, true))!;
    expect(plan.reveal).toBe(plan.full);
  });

  it("still shows on a laptop screen, with its 48 px margin", () => {
    const plan = planSideHide(chapter(1280, 48, 664, true));
    expect(plan).not.toBeNull();
    expect(plan!.reveal).toBeGreaterThanOrEqual(SIDE_MIN_ROOM);
  });

  it("is skipped on a phone and where the margin is too thin to read as a character", () => {
    expect(planSideHide(chapter(390, 16, 358, true))).toBeNull();
    expect(planSideHide(chapter(1100, 28, 600, true))).toBeNull();
  });

  it("takes the side with more room when no text sits beside the media", () => {
    const base = { vw: 1440, mediaLeft: 200, mediaRight: 800, size: 300, extent: 0.55 };
    expect(planSideHide({ ...base, text: null })?.side).toBe("right");
    expect(planSideHide({ ...base, mediaLeft: 640, mediaRight: 1240, text: null })?.side).toBe("left");
  });
});
