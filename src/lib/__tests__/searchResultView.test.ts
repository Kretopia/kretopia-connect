import { describe, expect, it } from "vitest";

import { RESULT_ACTION, directTarget, opportunityTiming, queryClass, queryWords, resultsSummary, snippetAround, whyOpportunity, whyPerson } from "../searchResultView";

const people = (...names: string[]) => names.map((title, i) => ({ kind: "person" as const, id: `p${i + 1}`, title }));

describe("what a result says about itself", () => {
  it("offers a specific next action per kind, never a bare 'View'", () => {
    expect(RESULT_ACTION).toEqual({ person: "View profile", opportunity: "View opportunity", work: "View work", event: "View event" });
  });

  it("folds case and accents and drops empties from the words", () => {
    expect(queryWords("  Café   DESIGNER ")).toEqual(["cafe", "designer"]);
  });

  it("clips a bio around the part that matched", () => {
    const bio = "Directing short films and commercials for ten years across Europe, then founded a studio in Lisbon focused on documentary photography and colour.";
    expect(snippetAround(bio, "documentary")).toMatch(/^….*documentary/);
    expect(snippetAround("Short bio", "x")).toBe("Short bio");
    expect(snippetAround(null, "x")).toBeNull();
    expect((snippetAround(bio, "documentary") ?? "").length).toBeLessThanOrEqual(78);
  });

  it("names the field that matched for a person, in plain words, and nothing when nothing did", () => {
    const p = { name: "Ada Lovelace", role: "Motion Designer", bio: "Makes titles for film.", location: "Bali" };
    expect(whyPerson("ada lovelace", p)).toBe("Name match");
    expect(whyPerson("motion", p)).toBe("Role: Motion Designer");
    expect(whyPerson("titles", p)).toMatch(/titles/);
    expect(whyPerson("bali", p)).toBe("Based in Bali");
    expect(whyPerson("zzz", p)).toBeNull();
  });

  it("names the field that matched for an opportunity", () => {
    const o = { title: "Hotel Campaign Bali", type: "Paid Job", skills: ["Photography"], location: "Bali" };
    expect(whyOpportunity("hotel campaign", o)).toBe("Title match");
    expect(whyOpportunity("photography", o)).toBe("Skill: Photography");
    expect(whyOpportunity("paid", o)).toBe("Type: Paid Job");
    expect(whyOpportunity("bali", { ...o, title: "Shoot" })).toBe("In Bali");
    expect(whyOpportunity("zzz", o)).toBeNull();
  });

  it("states timing honestly: a deadline, a passed deadline, or only the age of the post", () => {
    const now = new Date("2026-09-21T12:00:00Z");
    expect(opportunityTiming("2026-10-05T00:00:00Z", null, now, "en-GB")).toEqual({ label: "Apply by 5 Oct", closed: false });
    expect(opportunityTiming("2026-09-01T00:00:00Z", "2026-08-01T00:00:00Z", now, "en-GB")).toEqual({ label: "Deadline passed 1 Sept", closed: true });
    expect(opportunityTiming(null, "2026-09-21T01:00:00Z", now)).toEqual({ label: "Posted today", closed: false });
    expect(opportunityTiming(null, "2026-09-20T01:00:00Z", now)?.label).toBe("Posted yesterday");
    expect(opportunityTiming(null, "2026-09-16T00:00:00Z", now)?.label).toBe("Posted 5 days ago");
    expect(opportunityTiming(null, null, now)).toBeNull();
    expect(opportunityTiming("not a date", null, now)).toBeNull();
  });

  it("summarises in neutral words", () => {
    expect(resultsSummary("  Graphic Designer ")).toBe("Results for “Graphic Designer”");
  });
});

describe("when a search goes straight to an object", () => {
  it("opens the public profile for one exact, unique name", () => {
    expect(directTarget("all", "Ethan Auguste", people("Ethan Auguste", "Ethan Smith"))).toBe("/profile/p1");
    expect(directTarget("people", "ethan  auguste", people("Ethan Auguste"))).toBe("/profile/p1");
  });

  it("opens the opportunity for one exact, unique title", () => {
    const results = [{ kind: "opportunity" as const, id: "g1", title: "Hotel Campaign Bali" }];
    expect(directTarget("all", "hotel campaign bali", results)).toBe("/opportunity/g1");
    expect(directTarget("scout", "Hotel Campaign Bali", results)).toBe("/opportunity/g1");
  });

  it("does not redirect when the match is not unique or the query is generic", () => {
    expect(directTarget("all", "Ethan Auguste", people("Ethan Auguste", "ethan auguste"))).toBeNull();
    expect(directTarget("all", "photographer", people("Ada Lovelace"))).toBeNull();
    expect(directTarget("all", "ab", people("ab"))).toBeNull();
    // A name that is also an opportunity's title stays in the mixed results.
    expect(directTarget("all", "Bali", [{ kind: "person", id: "p1", title: "Bali" }, { kind: "opportunity", id: "g1", title: "Bali" }])).toBeNull();
  });

  it("only considers the kinds the topic looks for", () => {
    expect(directTarget("scout", "Ethan Auguste", people("Ethan Auguste"))).toBeNull();
    expect(directTarget("people", "Hotel Campaign Bali", [{ kind: "opportunity", id: "g1", title: "Hotel Campaign Bali" }])).toBeNull();
    expect(directTarget("match", "Ethan Auguste", people("Ethan Auguste"))).toBeNull();
    // Work and events have no canonical public page of their own to skip to.
    expect(directTarget("all", "Night", [{ kind: "event", id: "e1", title: "Night" }, { kind: "work", id: "w1", title: "Night" }])).toBeNull();
  });

  it("classifies a query for analytics without keeping its words", () => {
    expect(queryClass("x", [])).toBe("no_result");
    expect(queryClass("Ethan Auguste", people("Ethan Auguste"))).toBe("exact_person");
    expect(queryClass("Hotel", [{ kind: "opportunity", id: "g", title: "Hotel" }])).toBe("exact_opportunity");
    expect(queryClass("photo", people("Ada"))).toBe("generic");
  });
});
