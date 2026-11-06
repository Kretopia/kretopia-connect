import { describe, expect, it } from "vitest";
import { assessPressCandidate } from "../../../supabase/functions/_shared/pressCandidate";

const me = {
  fullName: "Noé Plantier",
  role: "Cinematographer",
  location: "Paris, France",
  website: "https://noeplantier.com",
  projectNames: ["Night Shift"],
  collaboratorNames: ["Dee Marshall"],
};

describe("assessPressCandidate: a name alone is not this person", () => {
  it("rejects a page that only shares the name", () => {
    const result = assessPressCandidate(me, { url: "https://farm.example/news", title: "Noé Plantier wins regional cheese prize", description: "The dairy farmer from Lyon." });
    expect(result).toEqual({ accept: false, matchedOn: [] });
  });

  it("rejects a page that does not contain the full name", () => {
    expect(assessPressCandidate(me, { title: "Plantier, cinematographer in Paris" }).accept).toBe(false);
  });

  it("accepts the same name when the page ties to the member's role, project or city, and says why", () => {
    const hit = assessPressCandidate(me, { title: "Noé Plantier on shooting Night Shift", description: "The Paris cinematographer talks light." });
    expect(hit.accept).toBe(true);
    expect(hit.matchedOn).toEqual(expect.arrayContaining(["role", "project", "location"]));
  });

  it("counts a co-signer named on the page and the member's own website", () => {
    expect(assessPressCandidate(me, { title: "Noé Plantier and Dee Marshall", description: "Interview" }).matchedOn).toContain("collaborator");
    expect(assessPressCandidate(me, { url: "https://www.noeplantier.com/press", title: "Noé Plantier" }).matchedOn).toContain("website");
  });

  it("needs a full name: a single word is too ambiguous to search on", () => {
    expect(assessPressCandidate({ fullName: "Plantier", role: "Cinematographer" }, { title: "Plantier cinematographer" }).accept).toBe(false);
  });
});
