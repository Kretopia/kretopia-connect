import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CARD_BUDGET, CARD_COVER_RATIO, CARD_RADIUS, CARD_SHADOW } from "../cardTokens";

// A card is a variant of CardShell: it fills slots and never decides its own shape. The shape (radius, border, elevation, cover ratio,
// padding, type scale, flip, tilt) is decided once, in cardTokens.ts, taken from the Scout hybrid card. These tests fail when a card file
// declares its own, so a new card cannot quietly drift from the others, and when an old bespoke card comes back.
const ROOT = resolve(__dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

/** Every card of the app, the family it belongs to, and the file that fills the shell's slots for it. */
export const VARIANTS = [
  { name: "opportunity", file: "src/components/scout/ScoutGigCard.tsx" },
  { name: "project", file: "src/components/project/studio/ProjectCard.tsx" },
  { name: "credit", file: "src/components/profile/AchievementCard.tsx" },
  { name: "profile", file: "src/components/passport/ProfileCard.tsx" },
];

/** Cards that are a variant under the name a surface knows: they map its data onto the variant and decide no shape either. */
export const ADAPTERS = [
  { name: "creator", file: "src/components/discover/CreatorPassportCard.tsx", variant: "ProfileCard" },
  { name: "directory", file: "src/components/passport/PassportDirectoryCard.tsx", variant: "ProfileCard" },
];

/** Bespoke cards that existed before the shell. They are gone, and a file of that name must not come back. */
export const DELETED: string[] = [
  // The feed's cards (credit, award, press, portfolio): each had its own shape, and nothing imported any of them.
  "src/components/feed/CreditActivityCard.tsx",
  "src/components/feed/AwardActivityCard.tsx",
  "src/components/feed/PressActivityCard.tsx",
  "src/components/feed/PortfolioItemCard.tsx",
];

// What a card file may not declare. Small radii (buttons, chips, avatars) are not a card's shape, so `rounded-full`, `rounded-md` and
// `rounded-[9px]` are fine; a card-level radius, any shadow, a cover ratio or an inline shape style is not.
const FORBIDDEN: Array<[string, RegExp]> = [
  ["a card-level radius (rounded-xl, 2xl, 3xl, or an arbitrary one of 12px or more)", /\brounded-(xl|2xl|3xl)\b|\brounded-\[(1[2-9]|[2-9]\d)px\]/],
  ["a shadow", /\b(?:hover:|focus:|dark:)?shadow-(?:sm|md|lg|xl|2xl|inner|glow|\[)/],
  ["a cover ratio", /\baspect-(?:video|square|\[)/],
  ["an inline shape style (borderRadius, boxShadow, aspectRatio)", /\b(?:borderRadius|boxShadow|aspectRatio)\s*:/],
];

const SHELL_FILES = ["src/components/cards/CardShell.tsx"];

describe("the shape of a card is decided once", () => {
  it("in cardTokens.ts: radius 16, a 16:9 cover, the hybrid card's elevation, and the budget the shell enforces", () => {
    expect(CARD_RADIUS).toBe("rounded-2xl");
    expect(CARD_COVER_RATIO).toBe("aspect-[16/9]");
    expect(CARD_SHADOW).toContain("0_18px_44px_-20px");
    expect(CARD_BUDGET).toEqual({ titleLines: 2, descriptionLines: 2, tags: 3, trustLines: 2 });
  });

  it("and HoloCard, the tilt shell, takes its radius and elevation from there instead of declaring its own", () => {
    const holo = read("src/components/passport/HoloCard.tsx");
    expect(holo).toContain("CARD_RADIUS");
    expect(holo).toContain("CARD_SHADOW");
    expect(holo).not.toMatch(/shadow-\[0_18px_44px/);
    expect(holo).not.toMatch(/\brounded-2xl\b/);
  });

  it.each([...VARIANTS.map((v) => v.file), ...ADAPTERS.map((a) => a.file), ...SHELL_FILES])("%s declares no shape of its own", (file) => {
    const source = read(file);
    for (const [what, pattern] of FORBIDDEN) {
      const hit = source.match(pattern);
      expect(hit, `${file} declares ${what}: "${hit?.[0]}". Change cardTokens.ts or use a slot of CardShell.`).toBeNull();
    }
  });

  it.each(VARIANTS)("the $name card is a CardShell and nothing else", ({ file }) => {
    expect(read(file)).toMatch(/from "@\/components\/cards\/CardShell"/);
    expect(read(file)).toMatch(/<CardShell\b/);
    expect(read(file), `${file} wraps its own HoloCard: the shell does that`).not.toMatch(/<HoloCard\b/);
  });

  it("and the guard itself can fail: it catches a card that declares its own shape, and lets buttons and chips keep theirs", () => {
    const caught = (source: string) => FORBIDDEN.some(([, pattern]) => pattern.test(source));
    for (const bad of ['className="rounded-2xl border"', 'className="rounded-xl"', 'className="rounded-[16px]"', 'className="shadow-lg"', 'className="hover:shadow-lg"',
      'className="shadow-[0_1px_2px_#000]"', 'className="aspect-video"', 'className="aspect-[4/3]"', "style={{ borderRadius: 12 }}", "style={{ boxShadow: 'none' }}"]) {
      expect(caught(bad), bad).toBe(true);
    }
    for (const fine of ['className="rounded-full"', 'className="rounded-md"', 'className="rounded-lg"', 'className="rounded-[9px]"', 'className="rounded-[10px]"', 'className="h-11 w-11"']) {
      expect(caught(fine), fine).toBe(false);
    }
  });

  it.each(ADAPTERS)("the $name card goes through $variant and builds no card of its own", ({ file, variant }) => {
    const source = read(file);
    expect(source).toMatch(new RegExp(`<${variant}\\b`));
    expect(source).not.toMatch(/<(HoloCard|Card|article)\b/);
  });

  it("no bespoke card that the shell replaced has come back", () => {
    for (const path of DELETED) expect(existsSync(resolve(ROOT, path)), `${path} should not exist`).toBe(false);
  });
});
