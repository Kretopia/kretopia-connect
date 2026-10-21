import { describe, expect, it, vi } from "vitest";
import type { RetroCard } from "../passport/retrospective";
import { drawRetrospectiveCard, layoutCard, RETRO_EXPORT, RETRO_QR_SIZE, wrapLines, type Measure, type TextItem } from "../passport/retrospectiveCanvas";

// A stand-in font: every character is 0.55 em wide.
const measure: Measure = (text, size) => text.length * size * 0.55;
const at = (size: number) => (text: string) => measure(text, size, 400);

const card = (over: Partial<RetroCard> = {}): RetroCard => ({ kind: "credits", kicker: "2026 so far", figure: 12, headline: "credits added to your Passport", detail: "5 of them verified or co-signed", ...over });
const rightEdge = (i: TextItem) => i.x + measure(i.text, i.size, i.weight);

describe("wrapLines", () => {
  it("wraps on spaces to the width", () => {
    expect(wrapLines(at(10), "aaaa bbbb cccc", 40, 5)).toEqual(["aaaa", "bbbb", "cccc"]);
    expect(wrapLines(at(10), "aa bb cc dd", 50, 5)).toEqual(["aa bb cc", "dd"]);
  });
  it("keeps a short text on one line", () => expect(wrapLines(at(10), "hello", 500, 2)).toEqual(["hello"]));
  it("splits a word that is wider than the line", () => {
    const lines = wrapLines(at(10), "abcdefghijklmnopqrst", 60, 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => at(10)(l) <= 60)).toBe(true);
    expect(lines.join("")).toBe("abcdefghijklmnopqrst");
  });
  it("ends the last allowed line with an ellipsis, and still fits", () => {
    const lines = wrapLines(at(10), "one two three four five six seven eight", 70, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(lines.every((l) => at(10)(l) <= 70)).toBe(true);
  });
  it("returns nothing for empty text", () => expect(wrapLines(at(10), "   ", 100, 2)).toEqual([]));
});

describe("layoutCard", () => {
  it("keeps every line inside the margins, even for a long headline and name", () => {
    const long = card({ headline: "an extraordinarily long headline that has to wrap onto several lines of text", detail: "Maya Laurent-Delacroix, a very long name that is repeated and repeated and repeated again" });
    const { items } = layoutCard(long, measure);
    for (const item of items) {
      expect(item.x).toBeGreaterThanOrEqual(96);
      expect(rightEdge(item)).toBeLessThanOrEqual(RETRO_EXPORT.width - 96 + 1);
    }
  });

  it("stacks the parts top to bottom without overlap, between the header and the footer", () => {
    const layout = layoutCard(card(), measure);
    const ys = layout.items.map((i) => i.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    const headline = layout.items.find((i) => i.size === 90)!;
    const figure = layout.items.find((i) => i.size === 312)!;
    expect(headline.y - headline.size * 0.9).toBeGreaterThan(figure.y); // the headline starts below the number's baseline
    expect(ys[0]).toBeGreaterThan(layout.mark.y + layout.mark.size);
    expect(ys[ys.length - 1]).toBeLessThan(layout.footer.y - layout.footer.size);
  });

  it("limits the headline to three lines, and the cover to two", () => {
    const text = "word ".repeat(80);
    expect(layoutCard(card({ headline: text, detail: null }), measure).items.filter((i) => i.size === 90)).toHaveLength(3);
    expect(layoutCard(card({ kind: "cover", figure: null, headline: text, detail: null }), measure).items.filter((i) => i.size === 150)).toHaveLength(2);
  });

  it("draws the big number only for a card that has one, in the accent colour", () => {
    expect(layoutCard(card({ figure: null }), measure).items.some((i) => i.size === 312)).toBe(false);
    const withFigure = layoutCard(card({ figure: 7 }), measure).items.find((i) => i.size === 312)!;
    expect(withFigure).toMatchObject({ text: "7", color: "#FF2DA1" });
  });

  it("places the QR only on the closing card, inside the grid, clear of the text above it", () => {
    expect(layoutCard(card(), measure).qr).toBeNull();
    const closing = layoutCard(card({ kind: "closing", figure: null, kicker: "Creative Passport", headline: "See the work behind the numbers", detail: "Maya" }), measure);
    expect(closing.qr).toMatchObject({ size: RETRO_QR_SIZE });
    expect(closing.qr!.x + closing.qr!.size).toBeLessThanOrEqual(RETRO_EXPORT.width);
    expect(closing.qr!.y + closing.qr!.size).toBeLessThan(closing.footer.y - closing.footer.size);
    const lastText = Math.max(...closing.items.filter((i) => i.size !== 44).map((i) => i.y));
    expect(closing.qr!.y).toBeGreaterThan(lastText);
  });

  it("is deterministic", () => {
    expect(layoutCard(card(), measure)).toEqual(layoutCard(card(), measure));
  });
});

function fakeCtx() {
  const calls: Array<[string, ...unknown[]]> = [];
  const ctx = {
    font: "", fillStyle: "", textAlign: "", textBaseline: "", letterSpacing: "",
    measureText: (t: string) => ({ width: t.length * 20 }),
    fillRect: (...a: unknown[]) => calls.push(["fillRect", ...a]),
    fillText: (...a: unknown[]) => calls.push(["fillText", ...a]),
    drawImage: (...a: unknown[]) => calls.push(["drawImage", ...a]),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("drawRetrospectiveCard", () => {
  it("paints the brand background over the whole picture, then the card's own words", () => {
    const { ctx, calls } = fakeCtx();
    drawRetrospectiveCard(ctx, card(), { fontFamily: "Inter, sans-serif" });
    expect(calls[0]).toEqual(["fillRect", 0, 0, 1080, 1920]);
    const words = calls.filter((c) => c[0] === "fillText").map((c) => c[1]);
    expect(words).toContain("12");
    expect(words).toContain("Kretopia");
    expect(words).toContain("2026 SO FAR");
    expect(words).toContain("Creative Passport · kretopia.com");
  });

  it("draws the K mark when given, and a letter K when it is missing", () => {
    const mark = {} as CanvasImageSource;
    const withMark = fakeCtx();
    drawRetrospectiveCard(withMark.ctx, card(), { fontFamily: "x", assets: { mark } });
    expect(withMark.calls.some((c) => c[0] === "drawImage" && c[1] === mark)).toBe(true);
    expect(withMark.calls.some((c) => c[0] === "fillText" && c[1] === "K")).toBe(false);
    const without = fakeCtx();
    drawRetrospectiveCard(without.ctx, card(), { fontFamily: "x" });
    expect(without.calls.some((c) => c[0] === "fillText" && c[1] === "K")).toBe(true);
  });

  it("draws the QR on the closing card only, and only once it exists", () => {
    const qr = {} as CanvasImageSource;
    const closing = card({ kind: "closing", figure: null, headline: "See the work", detail: null });
    const a = fakeCtx();
    drawRetrospectiveCard(a.ctx, closing, { fontFamily: "x", assets: { qr } });
    expect(a.calls.some((c) => c[0] === "drawImage" && c[1] === qr)).toBe(true);
    const b = fakeCtx();
    drawRetrospectiveCard(b.ctx, closing, { fontFamily: "x" });
    expect(b.calls.some((c) => c[0] === "drawImage" && c[1] === qr)).toBe(false);
    const c = fakeCtx();
    drawRetrospectiveCard(c.ctx, card(), { fontFamily: "x", assets: { qr } });
    expect(c.calls.some((x) => x[0] === "drawImage" && x[1] === qr)).toBe(false);
  });

  it("falls back to a system font when none is given", () => {
    const { ctx } = fakeCtx();
    const spy = vi.fn();
    Object.defineProperty(ctx, "font", { set: spy, get: () => "" });
    drawRetrospectiveCard(ctx, card(), { fontFamily: "" });
    expect(spy.mock.calls.some(([f]) => String(f).includes("system-ui"))).toBe(true);
  });
});
