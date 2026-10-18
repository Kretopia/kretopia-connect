import { describe, expect, it } from "vitest";
import { isComplementaryCraft, skillsTheyBring } from "../matchComplement";
import { ROLE_STAMP_LABEL, type RoleStampCategory } from "../passport/roleStamp";

const ALL = Object.keys(ROLE_STAMP_LABEL) as RoleStampCategory[];

describe("isComplementaryCraft: crafts that usually make one piece of work together", () => {
  it("pairs a photographer with a stylist, a musician with a filmmaker, a designer with a developer", () => {
    expect(isComplementaryCraft("photo_video", "fashion")).toBe(true);
    expect(isComplementaryCraft("music", "photo_video")).toBe(true);
    expect(isComplementaryCraft("design", "software")).toBe(true);
  });

  it("is symmetric for every pair of crafts", () => {
    for (const a of ALL) for (const b of ALL) expect(isComplementaryCraft(a, b)).toBe(isComplementaryCraft(b, a));
  });

  it("never pairs a craft with itself: that is 'similar', not 'complementary'", () => {
    for (const a of ALL) expect(isComplementaryCraft(a, a)).toBe(false);
  });

  it("leaves 'creator' out: it is the fallback for 'someone active here' and complements nothing in particular", () => {
    for (const a of ALL) {
      expect(isComplementaryCraft("creator", a)).toBe(false);
      expect(isComplementaryCraft(a, "creator")).toBe(false);
    }
  });

  it("is selective: crafts that do not usually combine are not paired", () => {
    expect(isComplementaryCraft("software", "dance")).toBe(false);
    expect(isComplementaryCraft("writing", "model")).toBe(false);
    const pairs = ALL.flatMap((a) => ALL.filter((b) => a < b && isComplementaryCraft(a, b)));
    const possible = (ALL.length * (ALL.length - 1)) / 2;
    expect(pairs.length).toBeGreaterThan(8);
    expect(pairs.length).toBeLessThan(possible / 2);
  });
});

describe("skillsTheyBring: what they list that you do not", () => {
  const mine = new Set(["lighting", "retouching"]);

  it("returns their skills missing from yours, lowercased, in their order, without duplicates", () => {
    expect(skillsTheyBring(mine, ["Lighting", "Colour grading", "colour grading", "  Sound design ", "Retouching"])).toEqual([
      "colour grading",
      "sound design",
    ]);
  });

  it("returns nothing when they list nothing new, nothing at all, or unusable values", () => {
    expect(skillsTheyBring(mine, ["lighting"])).toEqual([]);
    expect(skillsTheyBring(mine, [])).toEqual([]);
    expect(skillsTheyBring(mine, null)).toEqual([]);
    expect(skillsTheyBring(mine, undefined)).toEqual([]);
    expect(skillsTheyBring(mine, ["", "   "])).toEqual([]);
  });

  it("everything they list is new to someone who lists nothing", () => {
    expect(skillsTheyBring(new Set(), ["Editing", "Sound"])).toEqual(["editing", "sound"]);
  });
});
