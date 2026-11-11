import { describe, expect, it } from "vitest";
import { LEGACY_SCOUT_PATH, OPPORTUNITIES_PATH, SCOUT_PATH, isOpportunitySpace } from "../opportunityRoutes";

describe("the opportunity space", () => {
  it("has one home, with Scout inside it and the old Scout address kept as an alias", () => {
    expect(OPPORTUNITIES_PATH).toBe("/opportunities");
    expect(SCOUT_PATH).toBe("/scout");
    expect(SCOUT_PATH).toBe(LEGACY_SCOUT_PATH);
    expect(LEGACY_SCOUT_PATH).toBe("/scout");
  });

  it("covers the feed, Scout at either address, one opportunity and the poster's dashboard", () => {
    for (const path of ["/opportunities", SCOUT_PATH, LEGACY_SCOUT_PATH, "/scout/anything", "/opportunity/abc", "/opportunity-dashboard"]) {
      expect(isOpportunitySpace(path), path).toBe(true);
    }
  });

  it("does not claim neighbours: Match, the Passport directory, posting a gig, or a path that merely starts like Scout", () => {
    for (const path of ["/", "/match", "/passport", "/profile", "/desk", "/post-opportunity", "/scouting", "/creative-circle", "/perks"]) {
      expect(isOpportunitySpace(path), path).toBe(false);
    }
  });
});
