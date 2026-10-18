import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "u1" } as null | { id: string },
}));

vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: { full_name: "Ava", role: "Editor", bio: "A bio", avatar_url: "x", professional_skills: ["editing"] }, error: null });
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: state.user } }) },
      from: () => chain,
    },
  };
});
vi.mock("@/hooks/useMyCredits", () => ({
  useMyCredits: () => ({
    credits: [],
    overview: { total_credits: 0, verified_credits: 0, pending_credits: 0, missing_evidence: 0, endorsements_received: 0, last_credit_at: null },
    loading: false,
    searching: false,
    error: null,
    refresh: () => {},
  }),
}));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => <header /> }));
vi.mock("@/components/credits/CreditsOverviewCard", () => ({ CreditsOverviewCard: () => <section data-testid="overview" /> }));
vi.mock("@/components/credits/PersonalCreditsSearch", () => ({ PersonalCreditsSearch: () => null }));
vi.mock("@/components/credits/CreditsIdentityPanel", () => ({ CreditsIdentityPanel: () => <div data-testid="identity" /> }));
vi.mock("@/components/credits/CreditsHireMePanel", () => ({ CreditsHireMePanel: () => <div data-testid="hire-me" /> }));
vi.mock("@/components/credits/CreditsStampsPanel", () => ({ CreditsStampsPanel: () => <div data-testid="stamps" /> }));
vi.mock("@/components/credits/CreditsActivityTimeline", () => ({ CreditsActivityTimeline: () => <div data-testid="activity" /> }));
vi.mock("@/components/credits/CreditsAIInsights", () => ({ CreditsAIInsights: () => <div data-testid="insights" /> }));
// The Passport's own content: if the dashboard still embedded it, this would render.
vi.mock("@/pages/profile/ProfileContentSections", () => ({ ProfileContentSections: () => <div data-testid="passport-sections" /> }));

import CreditsDashboard from "../CreditsDashboard";

const renderPage = (initial = "/credits") =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <CreditsDashboard />
    </MemoryRouter>,
  );

describe("Credits dashboard: no second copy of the Passport", () => {
  it("offers Identity, Hire Me, Stamps, Activity and Next Steps, and no 'Full Record' tab", async () => {
    renderPage();
    await screen.findByTestId("overview");
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent?.trim());
    expect(tabs).toEqual(["Identity", "Hire Me", "Stamps", "Activity", "Next Steps"]);
    expect(screen.queryByRole("tab", { name: /Full Record/i })).toBeNull();
  });

  it("does not embed the Passport's sections, even from an old ?tab=record link", async () => {
    renderPage("/credits?tab=record");
    await screen.findByTestId("overview");
    expect(screen.queryByTestId("passport-sections")).toBeNull();
    expect(screen.queryByText(/Your full record/i)).toBeNull();
    // an unknown tab falls back to the default one instead of showing nothing
    expect(screen.getByTestId("identity")).toBeInTheDocument();
  });

  it("still opens the Stamps tab from its link", async () => {
    renderPage("/credits?tab=stamps");
    await screen.findByTestId("overview");
    expect(await screen.findByTestId("stamps")).toBeInTheDocument();
  });
});
