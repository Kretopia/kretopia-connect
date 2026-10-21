import { describe, expect, it } from "vitest";
import { emptyForm, formToNeed, splitTerms } from "../form";

describe("splitTerms", () => {
  it("trims, drops empties and repeats, and cuts long terms", () => {
    expect(splitTerms(" video editing , Color grading ,, video EDITING; sound\nmixing ")).toEqual(["video editing", "Color grading", "sound", "mixing"]);
    expect(splitTerms("a, b, ok")).toEqual(["ok"]); // one-character terms are noise
    expect(splitTerms("x".repeat(80))[0]).toHaveLength(40);
    expect(splitTerms("")).toEqual([]);
  });
});

describe("formToNeed", () => {
  it("asks for at least one criterion", () => {
    expect(formToNeed(emptyForm())).toEqual({ ok: false, error: "Add at least one criterion." });
  });

  it("builds a need from the fields, each group with its own importance", () => {
    const form = emptyForm();
    form.craft = { category: "creator", importance: "required" };
    form.skills = { text: "video editing, hooks", importance: "preferred" };
    form.themes = { text: "swimwear", importance: "required" };
    form.location = { text: "Los Angeles", remoteOk: true, importance: "preferred" };
    form.platforms = { selected: ["instagram", "tiktok"], minAudience: "50,000", importance: "required" };
    form.audience = { text: "women 18 to 24 in the US", importance: "required" };
    form.backedWork = { on: true, importance: "preferred" };
    const result = formToNeed(form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.need.craft).toEqual({ category: "creator", importance: "required" });
    expect(result.need.skills).toEqual([{ term: "video editing", importance: "preferred" }, { term: "hooks", importance: "preferred" }]);
    expect(result.need.themes).toEqual([{ term: "swimwear", importance: "required" }]);
    expect(result.need.location).toEqual({ text: "Los Angeles", remoteOk: true, importance: "preferred" });
    // platforms come out in the fixed platform order, each with the minimum audience
    expect(result.need.platforms.map((p) => [p.platform, p.minAudience])).toEqual([["tiktok", 50000], ["instagram", 50000]]);
    expect(result.need.audience?.description).toBe("women 18 to 24 in the US");
    expect(result.need.backedWork).toBe("preferred");
  });

  it("refuses a minimum audience that is not a whole number above zero", () => {
    for (const bad of ["abc", "0", "-5", "1.5"]) {
      const form = emptyForm();
      form.platforms = { selected: ["tiktok"], minAudience: bad, importance: "required" };
      expect(formToNeed(form)).toEqual({ ok: false, error: "Minimum audience must be a whole number above zero." });
    }
  });

  it("explains a limit that was exceeded instead of failing silently", () => {
    const form = emptyForm();
    form.skills.text = Array.from({ length: 9 }, (_, i) => `skill ${i}`).join(", ");
    expect(formToNeed(form)).toEqual({ ok: false, error: "Use at most 8 skills." });
    const loc = emptyForm();
    loc.location.text = "P";
    expect(formToNeed(loc)).toEqual({ ok: false, error: "Give a place of at least 2 characters." });
  });

  it("ignores a minimum audience when no platform is chosen", () => {
    const form = emptyForm();
    form.craft.category = "music";
    form.platforms.minAudience = "1000";
    const result = formToNeed(form);
    expect(result.ok && result.need.platforms).toEqual([]);
  });
});
