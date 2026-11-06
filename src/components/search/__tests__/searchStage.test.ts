import { describe, expect, it } from "vitest";
import { MIN_USEFUL_ROOM, computeSearchStage, searchFieldHeight } from "../searchStage";

const stage = (over: Partial<Parameters<typeof computeSearchStage>[0]> = {}) =>
  computeSearchStage({ viewportHeight: 900, viewportTop: 0, viewportWidth: 1440, safeTop: 0, ...over });

describe("computeSearchStage: the search field in the middle of the visible screen", () => {
  it("centres the field on a laptop and gives the results the lower half, less the field and the margins", () => {
    const s = stage();
    expect(s.mode).toBe("center");
    expect(s.top).toBe(450 - 32); // the 64 px field is centred on the middle line
    expect(s.room).toBe(450 - 32 - 8 - 16);
  });

  it("uses the smaller phone field below 640 px wide", () => {
    expect(searchFieldHeight(390)).toBe(56);
    expect(searchFieldHeight(640)).toBe(64);
    const s = stage({ viewportWidth: 390, viewportHeight: 750 });
    expect(s.top).toBe(375 - 28);
  });

  it("follows the visible area when the keyboard has shrunk it, instead of staying behind the keyboard", () => {
    // A phone with the keyboard open: 500 px visible, starting 0 from the top.
    const s = stage({ viewportWidth: 390, viewportHeight: 500 });
    expect(s.mode).toBe("center");
    expect(s.top + 56).toBeLessThan(500); // the whole field is in the visible area
    expect(s.top + 56 + 8 + s.room).toBeLessThanOrEqual(500 - 16 + 1); // and so is the list under it
  });

  it("accounts for the visual viewport being panned down from the layout viewport", () => {
    const s = stage({ viewportHeight: 600, viewportTop: 120 });
    expect(s.top).toBe(120 + 300 - 32);
  });

  it("moves the field to the top of the visible area when a centred field would leave no useful list", () => {
    // A phone on its side with the keyboard open.
    const s = stage({ viewportWidth: 740, viewportHeight: 260, safeTop: 0 });
    expect(s.mode).toBe("top");
    expect(s.top).toBe(16);
    expect(s.room).toBeGreaterThanOrEqual(0);
    // The centred option would have left less than the useful minimum.
    expect(260 / 2 - 32 - 8 - 16).toBeLessThan(MIN_USEFUL_ROOM);
  });

  it("keeps the field clear of a notch in top mode", () => {
    const s = stage({ viewportWidth: 740, viewportHeight: 260, safeTop: 47 });
    expect(s.mode).toBe("top");
    expect(s.top).toBe(47 + 16);
  });

  it("never reports a negative room", () => {
    expect(stage({ viewportHeight: 40 }).room).toBe(0);
  });
});
