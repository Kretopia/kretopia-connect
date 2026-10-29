import { describe, expect, it } from "vitest";
import { legacyTabTarget, stagesViewFor } from "../stagesRoutes";

describe("stagesViewFor", () => {
  it.each([
    ["/circle", "sound"],
    ["/soundstages", "sound"],
    ["/sound-stages", "sound"],
    ["/circle/stage/abc", "curated"],
    ["/circle/speed", "speed"],
    ["/circle/speed/", "speed"],
    ["/circle/speed/s1", "speed-session"],
    ["/circle/speed/s1/recap", "speed-recap"],
    ["/events/backstage", "backstage"],
  ])("%s is the %s view", (path, view) => {
    expect(stagesViewFor(path)).toBe(view);
  });
});

describe("legacyTabTarget: the old /circle tab links keep leading somewhere real", () => {
  it("Stages values stay on Stages", () => {
    expect(legacyTabTarget("")).toBeNull();
    expect(legacyTabTarget("?tab=stages")).toBeNull();
    expect(legacyTabTarget("?tab=live")).toBeNull();
    expect(legacyTabTarget("?tab=circles&circle=abc")).toBeNull();
    expect(legacyTabTarget("?join=stage-1")).toBeNull();
  });

  it("match, browse and network hand over to the matching Match tab", () => {
    expect(legacyTabTarget("?tab=match")).toBe("/match?tab=discover");
    expect(legacyTabTarget("?tab=browse")).toBe("/match?tab=browse");
    expect(legacyTabTarget("?tab=network")).toBe("/match?tab=connected");
  });

  it("the onboarding welcome handoff opens the deck and keeps its flag for the toast", () => {
    expect(legacyTabTarget("?welcome=match")).toBe("/match?welcome=match&tab=discover");
  });

  it("keeps every other query parameter", () => {
    expect(legacyTabTarget("?tab=network&ref=email")).toBe("/match?tab=connected&ref=email");
  });
});
