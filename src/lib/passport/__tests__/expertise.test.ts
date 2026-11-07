import { describe, expect, it } from "vitest";

import { EXPERTISE_LIMITS, buildExpertise, expertiseIsEmpty, skillNames } from "../expertise";

describe("skillNames", () => {
  it("reads the strings and the { skill } / { name } objects the two columns hold, without repeats", () => {
    expect(skillNames(["Colour grading", { skill: "Lighting", level: 4 }, { name: "Steadicam" }, "colour grading", "  ", null, 7])).toEqual([
      "Colour grading",
      "Lighting",
      "Steadicam",
    ]);
  });
  it("is empty for anything that is not a list", () => {
    expect(skillNames(null)).toEqual([]);
    expect(skillNames("Lighting")).toEqual([]);
    expect(skillNames({})).toEqual([]);
  });
});

describe("buildExpertise", () => {
  it("lists the title first, then the other roles, once each", () => {
    expect(buildExpertise({ jobTitle: "Director of Photography", role: "Cinematographer", subRoles: ["Colorist", "director of photography", " Gaffer "] }).roles).toEqual([
      "Director of Photography",
      "Colorist",
      "Gaffer",
    ]);
    // no title: the role stands in for it
    expect(buildExpertise({ role: "Cinematographer" }).roles).toEqual(["Cinematographer"]);
  });

  it("keeps skills and interests apart, and does not repeat a skill as an interest", () => {
    const e = buildExpertise({ professionalSkills: ["Lighting", "Grading"], passionSkills: ["lighting", "Surfing", { skill: "Chess" }] });
    expect(e.skills).toEqual(["Lighting", "Grading"]);
    expect(e.interests).toEqual(["Surfing", "Chess"]);
  });

  it("caps each list and invents nothing: no years, no levels, no seniority", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Skill ${i}`);
    const e = buildExpertise({ professionalSkills: many, passionSkills: many.map((s) => `${s} (hobby)`) });
    expect(e.skills).toHaveLength(EXPERTISE_LIMITS.skills);
    expect(e.interests).toHaveLength(EXPERTISE_LIMITS.interests);
    expect(Object.keys(e).sort()).toEqual(["awards", "credentials", "featuredIn", "interests", "roles", "skills"]);
  });

  it("drops credentials, awards and press with no title (and press with no link), and passes the rest through", () => {
    const e = buildExpertise({
      credentials: [{ id: "c1", title: "IMDb Pro", value: "#1,204" }, { id: "c2", title: " " }],
      awards: [{ id: "a1", title: "Best Cinematography", organization: "Lyon Festival", year: 2024 }, { id: "a2", title: "" }],
      press: [{ id: "p1", title: "Dee lights a short", publication: "Frame Weekly", url: "https://example.com/a" }, { id: "p2", title: "No link", url: "" }],
    });
    expect(e.credentials.map((c) => c.id)).toEqual(["c1"]);
    expect(e.awards.map((a) => a.id)).toEqual(["a1"]);
    expect(e.featuredIn.map((p) => p.id)).toEqual(["p1"]);
  });

  it("knows when there is nothing to show", () => {
    expect(expertiseIsEmpty(buildExpertise({}))).toBe(true);
    expect(expertiseIsEmpty(buildExpertise({ role: "Editor" }))).toBe(false);
  });
});
