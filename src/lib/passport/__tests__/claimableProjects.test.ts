import { describe, expect, it } from "vitest";

import { claimableProjects, projectPagePath } from "../claimableProjects";

describe("claimableProjects", () => {
  it("offers one entry per project, with how the Passport's owner is credited on it", () => {
    expect(
      claimableProjects([
        { id: "c1", project_name: "Night Train", role: "Director", year: 2024 },
        { id: "c2", project_name: "night train ", role: "Editor", year: 2023 },
        { id: "c3", title: "Open Road", role: "Colorist" },
      ]),
    ).toEqual([
      { id: "c1", name: "Night Train", role: "Director", year: 2024 },
      { id: "c3", name: "Open Road", role: "Colorist", year: null },
    ]);
  });

  it("leaves out a portfolio piece (no roll call) and a credit with no name (nothing to open)", () => {
    expect(
      claimableProjects([
        { id: "p1", project_name: "Showreel", source: "portfolio" },
        { id: "c1", project_name: "  " },
        { id: "c2" },
      ]),
    ).toEqual([]);
  });

  it("opens the project's own page, where its roles are claimed", () => {
    expect(projectPagePath("Night Train & Co")).toBe("/production?name=Night%20Train%20%26%20Co");
  });
});
