import { describe, expect, it } from "vitest";
import { KRETO_SCENES } from "@/components/brand/kretoScenes";
import { CATEGORY_IDS } from "@/lib/opportunityTaxonomy";
import { DEFAULT_ROLE_ART, ROLE_ART, TITLE_ART, roleArtCoverage, roleArtFor } from "@/lib/scoutRoleArt";

describe("role art lookup", () => {
  it("covers every family of the taxonomy, so no role is left without a picture", () => {
    expect(Object.keys(ROLE_ART).sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it("only names scenes that exist as local assets", () => {
    const scenes = [...Object.values(ROLE_ART), ...TITLE_ART.map((t) => t.art), DEFAULT_ROLE_ART].map((a) => a.scene);
    for (const scene of scenes) expect(KRETO_SCENES[scene], scene).toBeTruthy();
    // local files, never a remote address
    for (const scene of new Set(scenes)) expect(KRETO_SCENES[scene].src).not.toMatch(/^https?:/);
  });

  it("gives different rooms to different kinds of role, so the background changes with the role", () => {
    const scene = (category: (typeof CATEGORY_IDS)[number]) => roleArtFor({ category }).scene;
    expect(new Set([scene("audio-music"), scene("design-brand"), scene("engineering"), scene("sales-accounts"), scene("social-community"), scene("other")]).size).toBe(6);
  });

  it("uses the family when the listing was classified", () => {
    expect(roleArtFor({ category: "audio-music", title: "Mixing engineer" })).toEqual({ scene: "music-studio", fit: "exact" });
    expect(roleArtFor({ category: "design-brand", title: "Brand designer" }).scene).toBe("studio");
  });

  it("classifies by title when it was not", () => {
    expect(roleArtFor({ title: "Music producer for an indie label" }).scene).toBe("music-studio");
    expect(roleArtFor({ title: "Senior Software Engineer" }).scene).toBe("workspace");
  });

  it("gives the exact scene to the roles that have one, whatever their family", () => {
    expect(roleArtFor({ category: "writing-content", title: "Podcast host and producer" })).toEqual({ scene: "soundstages", fit: "exact" });
    expect(roleArtFor({ category: "ops-finance-people", title: "Technical Recruiter" })).toEqual({ scene: "talent-search", fit: "exact" });
  });

  it("says plainly that a photographer has no illustration of their own yet, and what is missing", () => {
    const art = roleArtFor({ category: "photo", title: "Photographer" });
    expect(art.fit).toBe("missing");
    expect(art.wanted).toBe("Kretopia photographer");
    expect(art.scene).toBe("studio"); // the stand-in
  });

  it("falls back to the documented default for a role that matches nothing, or has no title", () => {
    expect(roleArtFor({ title: "Zorblax wrangler" })).toEqual(DEFAULT_ROLE_ART);
    expect(roleArtFor({})).toEqual(DEFAULT_ROLE_ART);
    expect(roleArtFor({ category: "not-a-family" as never, title: null })).toEqual(DEFAULT_ROLE_ART);
    expect(DEFAULT_ROLE_ART).toEqual({ scene: "scout", fit: "default" });
  });

  it("reports which pairs are exact, close, missing and default", () => {
    const rows = roleArtCoverage();
    expect(rows).toHaveLength(CATEGORY_IDS.length);
    const missing = rows.filter((r) => r.fit === "missing");
    expect(missing.length).toBeGreaterThan(0);
    for (const row of missing) expect(row.wanted).toBeTruthy();
    expect(rows.filter((r) => r.fit === "default").map((r) => r.category)).toEqual(["other"]);
  });
});
