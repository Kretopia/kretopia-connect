import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/profile/AvailabilityIndicator", () => ({ AvailabilityIndicator: () => null }));
vi.mock("@/components/profile/TrustSignals", () => ({ TrustSignals: () => null }));

import { PublicPassportHero } from "../PublicPassportHero";

const profile = {
  user_id: "11111111-2222-3333-4444-555555555555",
  full_name: "Maya Laurent",
  username: "maya",
  role: "Motion Designer",
  location: "Paris, France",
  professional_skills: ["After Effects"],
  // all of these are on the row; none of them may become a link
  instagram_url: "https://instagram.com/maya",
  linkedin_url: "https://linkedin.com/in/maya",
  twitter_url: "https://x.com/maya",
  youtube_url: "https://youtube.com/@maya",
  spotify_url: "https://open.spotify.com/artist/maya",
  website: "https://maya.example.com",
  calendly_url: null as string | null,
};

const render_ = (over: Partial<typeof profile> = {}) =>
  render(
    <PublicPassportHero
      profile={{ ...profile, ...over }}
      connectionStatus="none"
      isOwner={false}
      isSignedIn={false}
      isConnecting={false}
      onConnect={() => {}}
      onMessage={() => {}}
      onCollaborate={() => {}}
      onAddToProject={() => {}}
      onShare={() => {}}
      onJoin={() => {}}
    />,
  );

describe("PublicPassportHero", () => {
  it("shows the Passport: name, role, place, ID", () => {
    render_();
    expect(screen.getByRole("heading", { name: "Maya Laurent" })).toBeInTheDocument();
    expect(screen.getByText("Motion Designer")).toBeInTheDocument();
    expect(screen.getByText("Paris, France")).toBeInTheDocument();
    expect(screen.getByText("KRT-11111")).toBeInTheDocument();
  });

  it("has no link to Instagram, LinkedIn, X, YouTube, Spotify or a personal site", () => {
    const { container } = render_();
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    for (const host of ["instagram", "linkedin", "x.com", "twitter", "youtube", "spotify", "maya.example.com"]) {
      expect(hrefs.some((h) => h.includes(host))).toBe(false);
    }
    expect(screen.queryByRole("link", { name: /Open (Instagram|LinkedIn|Twitter|YouTube|Spotify|Website)/ })).not.toBeInTheDocument();
  });

  it("has no booking link either, even when the profile has one", () => {
    const { container } = render_({ calendly_url: "https://calendly.com/maya/intro" } as never);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes("calendly"))).toBe(false);
    expect(screen.queryByRole("link", { name: /Book/ })).not.toBeInTheDocument();
  });

  it("offers no outbound link of any kind from the Passport card", () => {
    const { container } = render_();
    expect(container.querySelectorAll("a[target=_blank]")).toHaveLength(0);
  });
});
