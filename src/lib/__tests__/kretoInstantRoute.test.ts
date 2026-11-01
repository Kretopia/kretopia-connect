import { describe, expect, it } from "vitest";
import { matchKretoRoute } from "@/lib/kretoInstantRoute";

const scout = (q?: string) => (q ? `/scout?tab=all&q=${encodeURIComponent(q)}` : "/scout?tab=all");

describe("matchKretoRoute", () => {
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
    "Tell me about Scout's filters",
    "show me the match history of my project and explain how it was computed",
    "",
    "   ",
  ])("leaves %j to the model", (text) => {
    expect(matchKretoRoute(text)).toBeNull();
  });
});
