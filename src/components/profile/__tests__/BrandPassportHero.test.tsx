import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BrandPassportHero } from "../BrandPassportHero";

/**
 * Smoke coverage for the Brand Passport hero (the Brand-account equivalent
 * of the creator PassportHero, same HoloCard shell). No live browser/auth
 * session was available in this environment to verify against a real
 * company account, so this suite is the structural safety net: every
 * optional-field branch renders without throwing, and the key content each
 * branch is meant to produce is actually present.
 */

const baseProfile = {
  user_id: "11111111-2222-3333-4444-555555555555",
  company_name: "Acme Studios",
  company_logo_url: "https://example.com/logo.png",
  verification_status: "verified",
  email_verified: true,
  phone_verified: false,
  id_verified: false,
  payment_verified: true,
};

const baseStats = {
  oppsPosted: 4,
  activeJobs: 2,
  talentsHired: 3,
  completedHires: 2,
  avgResponseDays: 2,
};

function renderHero(overrides: { profile?: Record<string, unknown>; stats?: Partial<typeof baseStats> } = {}) {
  return render(
    <MemoryRouter>
      <BrandPassportHero
        profile={{ ...baseProfile, ...overrides.profile }}
        stats={{ ...baseStats, ...overrides.stats }}
        opportunities={[{ id: "opp-1", title: "Lead Editor", category: "Video", budget: "$2k" }]}
        teamMembers={[{ user_id: "u1", full_name: "Jane Doe", avatar_url: null }]}
        reviewCount={5}
        onEdit={vi.fn()}
        onShare={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("BrandPassportHero", () => {
  it("renders the brand name, Brand Passport pill and passport ID", () => {
    renderHero();
    expect(screen.getByText("Acme Studios")).toBeInTheDocument();
    expect(screen.getByText("Brand Passport")).toBeInTheDocument();
    expect(screen.getByText(/^BRD-/)).toBeInTheDocument();
  });

  it("shows the Trusted Partner tier for an established, verified brand", () => {
    renderHero({ profile: { average_rating: 4.5 } });
    expect(screen.getByText("Trusted Partner")).toBeInTheDocument();
  });

  it("falls back to a level badge for a brand new to hiring", () => {
    renderHero({ stats: { talentsHired: 0, activeJobs: 0, oppsPosted: 0, completedHires: 0 }, profile: { verification_status: undefined } });
    expect(screen.getByText("L1")).toBeInTheDocument();
    // Zero opportunities posted -> the next-action card should nudge posting one.
    expect(screen.getByText("Post your first opportunity")).toBeInTheDocument();
  });

  it("renders the hires/reviews trust line with the real counts passed in", () => {
    renderHero();
    expect(screen.getByText(/3 creators hired \(2 completed\)/)).toBeInTheDocument();
    expect(screen.getByText(/5 reviews/)).toBeInTheDocument();
  });

  it("renders recent opportunities and team members when provided", () => {
    renderHero();
    expect(screen.getByText("Lead Editor")).toBeInTheDocument();
    expect(screen.getByText("1 team member")).toBeInTheDocument();
  });

  it("does not throw when every optional field is missing", () => {
    expect(() =>
      render(
        <MemoryRouter>
          <BrandPassportHero
            profile={{ user_id: "u", company_name: "Bare Co" }}
            stats={{ oppsPosted: 0, activeJobs: 0, talentsHired: 0, completedHires: 0, avgResponseDays: 0 }}
            opportunities={[]}
            teamMembers={[]}
            reviewCount={0}
            onEdit={vi.fn()}
            onShare={vi.fn()}
          />
        </MemoryRouter>,
      ),
    ).not.toThrow();
    expect(screen.getByText("Bare Co")).toBeInTheDocument();
  });
});
