import { describe, it, expect } from "vitest";
import { inferWorkspaceType } from "@/lib/inferWorkspaceType";

describe("inferWorkspaceType", () => {
  it("infers photo_shoot from shoot-specific language", () => {
    expect(inferWorkspaceType("Editorial shoot with two models, headshots for the lookbook")).toBe("photo_shoot");
  });

  it("infers video_shoot from film/video language", () => {
    expect(inferWorkspaceType("A 60-second commercial spot, treatment due Friday")).toBe("video_shoot");
  });

  it("infers music_project from release language", () => {
    expect(inferWorkspaceType("Debut EP, five tracks, mixing and mastering this month")).toBe("music_project");
  });

  it("infers fashion_show from runway language", () => {
    expect(inferWorkspaceType("Runway show, 12 looks, model lineup confirmed")).toBe("fashion_show");
  });

  it("infers event_production from event language", () => {
    expect(inferWorkspaceType("Launch party at the venue, doors open at 8")).toBe("event_production");
  });

  it("infers commissioned_art from art-commission language", () => {
    expect(inferWorkspaceType("A digital illustration commission for a client portrait")).toBe("commissioned_art");
  });

  it("infers brand_collab from campaign/sponsor language", () => {
    expect(inferWorkspaceType("Sponsored campaign for a new brand launch")).toBe("brand_collab");
  });

  it("infers dj_live_gig from gig language", () => {
    expect(inferWorkspaceType("Three-hour DJ set at a club night")).toBe("dj_live_gig");
  });

  it("infers edit_job from post-production language", () => {
    expect(inferWorkspaceType("Need a color grade and audio mix pass")).toBe("edit_job");
  });

  it("infers content_series from podcast/series language", () => {
    expect(inferWorkspaceType("Weekly podcast, guest interviews every Thursday")).toBe("content_series");
  });

  it("infers content_series from generic social content language", () => {
    expect(inferWorkspaceType("A TikTok reel about our new product")).toBe("content_series");
  });

  it("falls back to general for unrecognized input", () => {
    expect(inferWorkspaceType("Something completely unrelated to any category")).toBe("general");
  });

  it("falls back to general for empty input", () => {
    expect(inferWorkspaceType("")).toBe("general");
  });

  it("is case-insensitive", () => {
    expect(inferWorkspaceType("RUNWAY SHOW WITH MODEL LINEUP")).toBe("fashion_show");
  });

  it("every non-general branch returns a real WorkspaceType key from workspaceConfigs", async () => {
    const { WORKSPACE_CONFIGS } = await import("@/lib/workspaceConfigs");
    const samples = [
      "podcast episode", "festival launch party", "album release", "brand sponsor campaign",
      "runway fashion show", "dj live gig", "color grade retouch", "illustration commission",
      "short film treatment", "photo shoot editorial", "instagram content post",
    ];
    for (const s of samples) {
      const result = inferWorkspaceType(s);
      expect(Object.keys(WORKSPACE_CONFIGS)).toContain(result);
    }
  });
});
