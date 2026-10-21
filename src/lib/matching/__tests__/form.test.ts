import { describe, expect, it } from "vitest";
import { addTerms, emptyForm, formToNeed, needToForm, splitTerms } from "../form";
import { matchNeedSchema } from "../need";

describe("splitTerms", () => {
  it("trims, drops empties and repeats, and cuts long terms", () => {
    expect(splitTerms(" video editing , Color grading ,, video EDITING; sound\nmixing ")).toEqual(["video editing", "Color grading", "sound", "mixing"]);
    expect(splitTerms("a, b, ok")).toEqual(["ok"]); // one-character terms are noise
    expect(splitTerms("x".repeat(80))[0]).toHaveLength(40);
    expect(splitTerms("")).toEqual([]);
  });
});

describe("addTerms", () => {
  it("adds new terms with the given importance and keeps what was there, importance included", () => {
    const items = [{ term: "Premiere", importance: "required" as const }];
    expect(addTerms(items, "after effects, premiere", "preferred")).toEqual([
      { term: "Premiere", importance: "required" },
      { term: "after effects", importance: "preferred" },
    ]);
  });
});

describe("formToNeed", () => {
  it("asks for at least one criterion", () => {
    expect(formToNeed(emptyForm())).toEqual({ ok: false, error: "Add at least one criterion." });
  });

  it("builds a need from the fields, keeping the importance of each term and each platform", () => {
    const form = emptyForm();
    form.craft = { category: "creator", importance: "required" };
    form.skills = { items: [{ term: "Premiere", importance: "required" }, { term: "After Effects", importance: "preferred" }], draft: "hooks" };
    form.themes = { items: [], draft: "swimwear" };
    form.location = { text: "Los Angeles", remoteOk: true, importance: "preferred" };
    form.platforms = [{ platform: "instagram", importance: "preferred", minAudience: "" }, { platform: "tiktok", importance: "required", minAudience: "50,000" }];
    form.audience = { text: "women 18 to 24 in the US", importance: "required" };
    form.backedWork = { on: true, importance: "preferred" };
    const result = formToNeed(form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.need.skills).toEqual([
      { term: "Premiere", importance: "required" },
      { term: "After Effects", importance: "preferred" },
      { term: "hooks", importance: "required" }, // text typed but not added counts, as a required skill
    ]);
    expect(result.need.themes).toEqual([{ term: "swimwear", importance: "preferred" }]);
    // platforms come out in the fixed platform order, each with its own importance and minimum
    expect(result.need.platforms).toEqual([{ platform: "tiktok", minAudience: 50000, importance: "required" }, { platform: "instagram", importance: "preferred" }]);
  });

  it("refuses a minimum audience that is not a whole number above zero", () => {
    for (const bad of ["abc", "0", "-5", "1.5"]) {
      const form = emptyForm();
      form.platforms = [{ platform: "tiktok", importance: "required", minAudience: bad }];
      expect(formToNeed(form)).toEqual({ ok: false, error: "Minimum audience must be a whole number above zero." });
    }
  });

  it("explains a limit that was exceeded instead of failing silently", () => {
    const form = emptyForm();
    form.skills.draft = Array.from({ length: 9 }, (_, i) => `skill ${i}`).join(", ");
    expect(formToNeed(form)).toEqual({ ok: false, error: "Use at most 8 skills." });
    const loc = emptyForm();
    loc.location.text = "P";
    expect(formToNeed(loc)).toEqual({ ok: false, error: "Give a place of at least 2 characters." });
  });
});

describe("needToForm", () => {
  const need = matchNeedSchema.parse({
    craft: { category: "photo_video", importance: "required" },
    skills: [{ term: "Premiere", importance: "required" }, { term: "After Effects", importance: "preferred" }],
    themes: [{ term: "swimwear", importance: "preferred" }],
    location: { text: "Paris", remoteOk: true, importance: "preferred" },
    platforms: [{ platform: "tiktok", minAudience: 20000, importance: "required" }, { platform: "instagram", importance: "preferred" }],
    audience: { description: "women 18 to 24", importance: "required" },
    backedWork: "preferred",
  });

  it("shows every criterion Kreto set, with its importance", () => {
    const form = needToForm(need);
    expect(form.craft).toEqual({ category: "photo_video", importance: "required" });
    expect(form.skills.items).toEqual([{ term: "Premiere", importance: "required" }, { term: "After Effects", importance: "preferred" }]);
    expect(form.platforms).toEqual([{ platform: "tiktok", importance: "required", minAudience: "20000" }, { platform: "instagram", importance: "preferred", minAudience: "" }]);
    expect(form.audience).toEqual({ text: "women 18 to 24", importance: "required" });
    expect(form.backedWork).toEqual({ on: true, importance: "preferred" });
  });

  it("round-trips: what the form shows is the need that is searched", () => {
    const back = formToNeed(needToForm(need));
    expect(back).toEqual({ ok: true, need });
  });

  it("gives an empty form for an empty need", () => {
    expect(needToForm({ skills: [], themes: [], platforms: [] })).toEqual(emptyForm());
  });
});
