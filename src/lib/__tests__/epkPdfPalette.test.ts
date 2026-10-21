import { describe, expect, it } from "vitest";
import { EPK_CATEGORY_ACCENTS, EPK_DEFAULT_ACCENT_HEX, EPK_TEMPLATES } from "../epkPdfGenerator";

// The press kit used the logo gradient's violet stop (#A516C5) as its accent, which read as aggressive. The accent is
// now the Kretopia pink, and it must stay readable on each template's own canvas.
type Rgb = readonly [number, number, number];

const hue = ([r, g, b]: Rgb): number | null => {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  if (d < 0.08) return null; // a grey has no hue
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return (Math.round(h * 60) + 360) % 360;
};
const luminance = (rgb: Rgb) => {
  const [R, G, B] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const contrast = (a: Rgb, b: Rgb) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const fromHex = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
const isViolet = (rgb: Rgb) => { const h = hue(rgb); return h !== null && h >= 250 && h <= 300; };

describe("press kit palettes", () => {
  for (const template of EPK_TEMPLATES) {
    describe(template.name, () => {
      it("has no violet in its accent colours", () => {
        expect(isViolet(template.palette.primary as Rgb)).toBe(false);
        expect(isViolet(template.palette.accent as Rgb)).toBe(false);
      });

      it("keeps its accent readable on its own canvas (WCAG AA, 4.5:1)", () => {
        expect(contrast(template.palette.primary as Rgb, template.palette.bg as Rgb)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(template.palette.primary as Rgb, template.palette.card as Rgb)).toBeGreaterThanOrEqual(4.5);
      });

      it("shows the swatch the PDF really uses", () => {
        const swatch = /#([0-9A-Fa-f]{6})/.exec(template.previewAccent)![0];
        expect(fromHex(swatch)).toEqual(template.palette.primary);
      });
    });
  }

  it("starts the editor on the same pink, not violet", () => {
    expect(EPK_DEFAULT_ACCENT_HEX).toBe("#F6288D");
    expect(isViolet(fromHex(EPK_DEFAULT_ACCENT_HEX))).toBe(false);
    expect(fromHex(EPK_DEFAULT_ACCENT_HEX)).toEqual(EPK_TEMPLATES[0].palette.primary);
  });

  it("has no violet among the credit-card category colours, and no two categories share one", () => {
    const entries = Object.entries(EPK_CATEGORY_ACCENTS);
    expect(entries.length).toBeGreaterThan(4);
    for (const [, rgb] of entries) expect(isViolet(rgb)).toBe(false);
    expect(new Set(entries.map(([, rgb]) => rgb.join(","))).size).toBe(entries.length);
  });

  it("the check itself recognises the old violet", () => {
    expect(isViolet([165, 22, 197])).toBe(true);
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
  });
});
