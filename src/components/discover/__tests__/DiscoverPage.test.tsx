import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Discover from "@/pages/Discover";

const { auth, queries } = vi.hoisted(() => ({
  auth: { user: null as null | { id: string } },
  queries: {
    fetchLiveStages: vi.fn(),
    fetchNearbyEvents: vi.fn(),
    fetchGigs: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/components/today/radar/radar.queries", () => queries);

// Only the new members count goes through the client directly: a chain that ends in a count.
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.not = () => chain;
  chain.gte = () => Promise.resolve({ count: 3, error: null });
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { from: () => chain, channel: () => channel, removeChannel: vi.fn() } };
});

vi.mock("@/components/features/FeaturePageHeader", () => ({
  FeaturePageHeader: ({ title, accentTitle, tutorial }: { title: string; accentTitle: string; tutorial?: { label: string; steps: unknown[] } }) => (
    <header data-testid="feature-header">
      <h1>
        {title} {accentTitle}
      </h1>
      {tutorial && <span>{tutorial.label}</span>}
    </header>
  ),
}));
vi.mock("@/components/swipe", () => ({ SwipeFeature: () => <div>swipe deck</div> }));
vi.mock("@/components/opportunity/ScoutedGigsSection", () => ({ ScoutedGigsSection: () => <div>scouted gigs</div> }));
vi.mock("@/components/circle/OpportunitiesFeed", () => ({ OpportunitiesFeed: () => <div>open gigs</div> }));
vi.mock("@/components/circle/LiveCallsPanel", () => ({ LiveCallsPanel: () => <div>live panel</div> }));
vi.mock("@/components/sessions/SessionsSection", () => ({ SessionsSection: () => <div>events panel</div> }));
vi.mock("@/components/discover/NearbyInline", () => ({ NearbyInline: () => <div>nearby panel</div> }));
vi.mock("@/components/discover/BrowseCreators", () => ({ BrowseCreators: () => <div>browse grid</div> }));
vi.mock("@/components/agent/KretoTip", () => ({ KretoTip: () => <div>kreto tip</div> }));
vi.mock("@/components/PostOpportunityDialog", () => ({ PostOpportunityDialog: () => null }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));

const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
};

function renderDiscover(entry = "/discover") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Where />
        <Routes>
          <Route path="/discover" element={<Discover />} />
          <Route path="/talent-finder" element={<div>talent finder page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const lane = (name: string) => screen.getByRole("tab", { name });
const open = (name: string) => fireEvent.mouseDown(lane(name), { button: 0 });

describe("Discover page", () => {
  beforeEach(() => {
    auth.user = null;
    queries.fetchLiveStages.mockResolvedValue({ rows: [], count: 2 });
    queries.fetchNearbyEvents.mockResolvedValue({ rows: [], weekCount: 1 });
    queries.fetchGigs.mockResolvedValue({ top: [], newCount: 4 });
  });

  it("wears the shared feature header with its own tour", () => {
    renderDiscover();
    const header = screen.getByTestId("feature-header");
    expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent("Discover. Meet, scout, join in.");
    expect(within(header).getByText("How Discover works")).toBeInTheDocument();
    expect(screen.queryByText("The Hub")).not.toBeInTheDocument();
  });

  it("opens on People and Swipe, with the four lanes in one switcher", () => {
    renderDiscover();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["People", "Gigs", "Live", "Events"]);
    expect(lane("People")).toHaveAttribute("data-state", "active");
    expect(screen.getByText("swipe deck")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /creatives to meet/i })).toBeInTheDocument();
  });

  it("switches lane from the switcher and keeps it in the URL", () => {
    renderDiscover();
    open("Gigs");
    expect(screen.getByText("scouted gigs")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /gigs that fit/i })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/discover?tab=opps");
  });

  it("opens the lane a link asks for, including the older 'opportunities' link, and falls back to People", () => {
    renderDiscover("/discover?tab=opportunities");
    expect(lane("Gigs")).toHaveAttribute("data-state", "active");
  });

  it("treats an unknown tab as People", () => {
    renderDiscover("/discover?tab=nonsense");
    expect(lane("People")).toHaveAttribute("data-state", "active");
  });

  it("shows a guest the three public numbers, each a way into its lane", async () => {
    renderDiscover();
    const signals = screen.getByRole("list", { name: "Discover signals" });
    expect(await within(signals).findByText("creatives joined")).toBeInTheDocument();
    expect(await within(signals).findByText("Stages live now")).toBeInTheDocument();
    expect(within(signals).getByText("event this week")).toBeInTheDocument();
    expect(within(signals).queryByText(/for you/)).not.toBeInTheDocument();
    expect(await screen.findByText("2 Stages on air")).toBeInTheDocument();

    fireEvent.click(within(signals).getByRole("button", { name: /Stages live now/ }));
    expect(lane("Live")).toHaveAttribute("data-state", "active");
    expect(screen.getByText("live panel")).toBeInTheDocument();
  });

  it("adds the gigs number for a signed-in person, and it leads to Gigs", async () => {
    auth.user = { id: "u1" };
    renderDiscover();
    const signals = screen.getByRole("list", { name: "Discover signals" });
    expect(await within(signals).findByText("new gigs for you")).toBeInTheDocument();
    fireEvent.click(within(signals).getByRole("button", { name: /new gigs for you/ }));
    expect(lane("Gigs")).toHaveAttribute("data-state", "active");
  });

  it("no longer draws a separate 'stages on air' banner: the Live tile is the one place", async () => {
    renderDiscover();
    await screen.findByText("2 Stages on air");
    expect(screen.queryByText(/Tap to join/)).not.toBeInTheDocument();
  });

  it("switches People modes in place, and Talent leaves for its own page", async () => {
    renderDiscover();
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    expect(await screen.findByText("browse grid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Swipe" })).toHaveAttribute("aria-pressed", "false");

    // Talent is a page of its own, not a mode: it is never "pressed".
    expect(screen.getByRole("button", { name: /Talent/ })).not.toHaveAttribute("aria-pressed");
    fireEvent.click(screen.getByRole("button", { name: /Talent/ }));
    await waitFor(() => expect(screen.getByText("talent finder page")).toBeInTheDocument());
  });

  it("keeps Leads, with both links, inside the Gigs lane", () => {
    renderDiscover("/discover?tab=opps");
    fireEvent.click(screen.getByRole("button", { name: "Leads" }));
    expect(screen.getByRole("link", { name: "Open Opportunity Intel" })).toHaveAttribute("href", "/intel");
    expect(screen.getByRole("link", { name: "Set sponsor radar" })).toHaveAttribute("href", "/intel?focus=sponsors");
  });
});
