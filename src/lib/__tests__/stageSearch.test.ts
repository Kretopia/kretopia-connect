import { describe, expect, it } from "vitest";

import { filterStagesByQuery } from "../stageSearch";

const stages = [
  { title: "Late Night Beats", hostName: "@maya" },
  { title: "Café Sessions", hostName: "@noe" },
  { title: "Photo Walk", hostName: null },
];

describe("filtering stages by the landing search words", () => {
  it("returns every stage when there are no words", () => {
    expect(filterStagesByQuery(stages, "")).toHaveLength(3);
    expect(filterStagesByQuery(stages, "   ")).toHaveLength(3);
    expect(filterStagesByQuery(stages, null)).toHaveLength(3);
  });

  it("matches on the title or the host, ignoring case and accents", () => {
    expect(filterStagesByQuery(stages, "beats").map((s) => s.title)).toEqual(["Late Night Beats"]);
    expect(filterStagesByQuery(stages, "CAFE").map((s) => s.title)).toEqual(["Café Sessions"]);
    expect(filterStagesByQuery(stages, "@noe").map((s) => s.title)).toEqual(["Café Sessions"]);
  });

  it("needs every word to match, in any order", () => {
    expect(filterStagesByQuery(stages, "night late")).toHaveLength(1);
    expect(filterStagesByQuery(stages, "night walk")).toHaveLength(0);
  });
});
