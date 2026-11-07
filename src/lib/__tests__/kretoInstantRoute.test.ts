import { describe, expect, it } from "vitest";
import { matchKretoRoute } from "@/lib/kretoInstantRoute";

const scout = (q?: string) => (q ? `/scout?tab=all&q=${encodeURIComponent(q)}` : "/scout?tab=all");

describe("matchKretoRoute", () => {
  it("opens results immediately for Search for UX Designers with the full query", () => {
    const route = matchKretoRoute("Search for UX Designers");
    expect(route?.path).toBe("/search?q=UX%20Designers");
    expect(route?.query).toBe("UX Designers");
  });

  it.each([
    ["Please search for UX Designers", "UX Designers"],
    ["Find UX Designers", "UX Designers"],
    ["Recherche des designers UX", "designers UX"],
  ])("opens search results for %j", (text, query) => {
    expect(matchKretoRoute(text)?.path).toBe(`/search?q=${encodeURIComponent(query)}`);
  });

  it("opens Scout with the role searched, from the exact request of the demo", () => {
    const r = matchKretoRoute("search a job opportunity UX Designer");
    expect(r?.path).toBe(scout("UX Designer"));
    expect(r?.query).toBe("UX Designer");
    expect(r?.reply).toBe("Opening Scout for “UX Designer”.");
  });

  it.each([
    ["Find me a UX Designer job in Paris", "UX Designer Paris"],
    ["Scout : UX Designer", "UX Designer"],
    ["scout UX designer jobs", "UX designer"],
    ["looking for UX designer jobs", "UX designer"],
    ["search a job as UX designer for Spotify", "UX designer Spotify"],
    ["I'm looking for a job as a UX Designer at Google", "UX Designer Google"],
    ["Please search a job opportunity as a Motion Designer.", "Motion Designer"],
    ["I need a gig for a 3D artist", "3D artist"],
    ["UX designer jobs", "UX designer"],
    ["opportunities in motion design", "motion design"],
    ["emplois designer UX", "designer UX"],
  ])("extracts the term from %j", (text, query) => {
    expect(matchKretoRoute(text)?.path).toBe(scout(query));
  });

  it("answers in French when the request is in French", () => {
    const r = matchKretoRoute("Cherche un emploi de designer UX à Paris");
    expect(r?.path).toBe(scout("designer UX Paris"));
    expect(r?.reply).toBe("J’ouvre Scout pour « designer UX Paris ».");
  });

  it("opens Scout without a term when the request names none", () => {
    expect(matchKretoRoute("search a job opportunity")?.path).toBe(scout());
    expect(matchKretoRoute("open scout")?.path).toBe(scout());
    expect(matchKretoRoute("UX designer on scout")?.path).toBe(scout("UX designer"));
  });

  it("has no limit on the length of the message", () => {
    const background = "I am a product designer who has worked on mobile apps for many years and cares about accessibility. ".repeat(60);
    const long = `${background}Please search a job as Motion Designer. ${background}`;
    expect(long.length).toBeGreaterThan(10000);
    expect(matchKretoRoute(long)?.path).toBe(scout("Motion Designer"));
  });

  describe("an opportunity request never lands on the people search", () => {
    it.each([
      ["find work as a colorist", "colorist"],
      ["Find me freelance work", undefined],
      ["I want to find paid work", undefined],
      ["looking for work in Lisbon", "Lisbon"],
      ["Cherche des missions de montage", "montage"],
      ["Trouve moi du travail en freelance", undefined],
      ["search for commissions", undefined],
      ["find casting calls in London", "London"],
      ["any gigs near Lisbon?", "Lisbon"],
      ["find job openings for editors", "editors"],
    ])("opens Scout for %j", (text, query) => {
      const r = matchKretoRoute(text);
      expect(r?.path).toBe(scout(query));
      expect(r?.path.startsWith("/search")).toBe(false);
    });

    it("sends the prompts Kreto itself offers to Scout with no invented filter", () => {
      // The Today tip's button and the Kreto page's chip: the whole sentence is about the person and the answer, not a role to filter on.
      for (const prompt of [
        "Find me three new opportunities I should pursue this week and explain why each one fits.",
        "Find opportunities that match my skills and availability right now.",
        "Find me opportunities",
      ]) {
        expect(matchKretoRoute(prompt)?.path).toBe(scout());
      }
    });

    it("keeps a role or a place that comes before a clause about the person", () => {
      expect(matchKretoRoute("find UX designer jobs that match my skills")?.path).toBe(scout("UX designer"));
      expect(matchKretoRoute("find motion design gigs in Berlin I should apply to this week")?.path).toBe(scout("motion design Berlin"));
      expect(matchKretoRoute("Find me gigs I should apply to")?.path).toBe(scout());
    });

    it("does not read someone's work as an opportunity", () => {
      for (const text of ["look at my work", "show me my work", "find work by Noé Plantier", "search my work for typos", "Trouve mon travail"]) {
        expect(matchKretoRoute(text)?.path ?? "").not.toMatch(/^\/scout/);
      }
    });
  });

  it("still sends a search for people to the results page", () => {
    expect(matchKretoRoute("look for a freelance mixing engineer")?.path).toBe("/search?q=freelance%20mixing%20engineer");
    expect(matchKretoRoute("find three UX designers")?.path).toBe("/search?q=three%20UX%20designers");
  });

  it("opens the page it names", () => {
    expect(matchKretoRoute("open match")?.path).toBe("/match");
    expect(matchKretoRoute("show me my wallet")?.path).toBe("/thrivepay");
    expect(matchKretoRoute("ouvre les meetups")?.path).toBe("/meetup");
    expect(matchKretoRoute("go to discover")?.path).toBe("/discover");
  });

  it.each([
    "How do I find a job on Kretopia?",
    "What is Scout?",
    "Why can't I see any gigs?",
    "Comment trouver un emploi ?",
    "Write a bio for my passport",
    "Help me plan my project",
    "Find a collaborator for my project",
    "I need a role model",
    "Can you check why my jobs page is slow today when the list is empty for everyone",
    "Tell me about Scout's filters",
    "show me the match history of my project and explain how it was computed",
    "",
    "   ",
  ])("leaves %j to the model", (text) => {
    expect(matchKretoRoute(text)).toBeNull();
  });
});
