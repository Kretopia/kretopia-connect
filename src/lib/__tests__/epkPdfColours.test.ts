import { beforeEach, describe, expect, it, vi } from "vitest";

// What the press kit really paints, not just what its palette says: every colour the generator sets while drawing a kit
// with a film credit (the category that used to be violet), per template. A fake jsPDF records the calls.
const painted: Array<[number, number, number]> = [];

vi.mock("jspdf", () => {
  class FakeDoc {
    internal = { pageSize: { getWidth: () => 338, getHeight: () => 190 }, getNumberOfPages: () => 1 };
    GState = class { constructor(public opts: unknown) {} };
    constructor() {
      return new Proxy(this, {
        get(target, prop: string) {
          if (prop in target) return (target as unknown as Record<string, unknown>)[prop];
          if (prop === "setFillColor" || prop === "setTextColor" || prop === "setDrawColor") {
            return (...args: unknown[]) => { if (args.length === 3 && args.every((a) => typeof a === "number")) painted.push(args as [number, number, number]); return target; };
          }
          if (prop === "getTextWidth") return () => 10;
          if (prop === "splitTextToSize") return (t: string) => [String(t)];
          if (prop === "getNumberOfPages") return () => 1;
          if (prop === "output") return () => new Blob();
          return () => target;
        },
      });
    }
  }
  return { default: FakeDoc };
});

import { EPK_TEMPLATES, generateEPKPdf } from "../epkPdfGenerator";

const hue = ([r, g, b]: [number, number, number]): number | null => {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  if (d < 0.08) return null;
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return (Math.round(h * 60) + 360) % 360;
};

const input = () => ({
  profile: { full_name: "Maya Laurent", user_id: "11111111-2222-3333-4444-555555555555", role: "Director", bio: "Films.", location: "Paris", professional_skills: ["Directing"] },
  credits: [
    { project_name: "Nord", role: "Director", year: 2025, credit_category: "film" },
    { project_name: "Echo", role: "Composer", year: 2024, credit_category: "music" },
  ],
  awards: [], pressLinks: [], industryStats: [], reviews: [],
});

beforeEach(() => { painted.length = 0; });

describe("what the press kit paints", () => {
  for (const template of EPK_TEMPLATES) {
    it(`${template.name}: uses its pink accent and paints no violet anywhere, film credits included`, async () => {
      await generateEPKPdf(input() as never, { templateId: template.id } as never);
      expect(painted.length).toBeGreaterThan(20);
      expect(painted.some((c) => c.join(",") === (template.palette.primary as number[]).join(","))).toBe(true);
      const violet = painted.filter((c) => { const h = hue(c); return h !== null && h >= 250 && h <= 300; });
      expect(violet).toEqual([]);
    });
  }
});
