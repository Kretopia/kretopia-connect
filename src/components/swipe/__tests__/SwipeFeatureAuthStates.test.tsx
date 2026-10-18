import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { user: null as null | { id: string }, loading: false },
  deck: { profiles: [] as unknown[], loading: false, error: null as string | null },
  navigate: vi.fn(),
  fetchProfiles: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/useSwipeProfiles", () => ({
  useSwipeProfiles: () => ({
    profiles: state.deck.profiles,
    allProfilesCount: state.deck.profiles.length,
    loading: state.deck.loading,
    error: state.deck.error,
    fetchProfiles: state.fetchProfiles,
    removeProfile: vi.fn(),
  }),
}));
vi.mock("@/hooks/useSwipeActions", () => ({ useSwipeActions: () => ({ recordSwipe: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  for (const m of ["select", "eq", "single", "maybeSingle"]) chain[m] = () => chain;
  chain.then = (resolve: (v: { data: null; count: number; error: null }) => unknown) => resolve({ data: null, count: 0, error: null });
  return { supabase: { from: () => chain } };
});
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => state.navigate }));
vi.mock("../MatchModal", () => ({ MatchModal: () => null }));
vi.mock("../ProfilePreviewSheet", () => ({ ProfilePreviewSheet: () => null }));
vi.mock("@/components/discover/MatchExplanationDialog", () => ({ MatchExplanationDialog: () => null }));
vi.mock("@/components/discover/HingeStyleCard", () => ({ HingeStyleCard: ({ profile }: any) => <div>card:{profile.full_name}</div> }));

import { MemoryRouter } from "react-router-dom";
import { SwipeFeature } from "../SwipeFeature";

const renderDeck = () =>
  render(
    <MemoryRouter>
      <SwipeFeature />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.auth = { user: null, loading: false };
  state.deck = { profiles: [], loading: false, error: null };
  state.navigate.mockClear();
});

describe("Match deck: who is looking", () => {
  it("a visitor with no account is asked to sign in, and is never told they have seen everyone", () => {
    renderDeck();
    expect(screen.getByRole("heading", { name: "Sign in to get your deck" })).toBeInTheDocument();
    expect(screen.queryByText(/All Caught Up/)).toBeNull();
    expect(screen.queryByText(/seen everyone/)).toBeNull();
  });

  it("offers the sign-in and the grid, which works without an account", () => {
    renderDeck();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(state.navigate).toHaveBeenLastCalledWith("/auth?next=/match");
    fireEvent.click(screen.getByRole("button", { name: /Browse the grid/ }));
    expect(state.navigate).toHaveBeenLastCalledWith("/match?tab=browse");
  });

  it("while the session is still loading it shows neither message", () => {
    state.auth = { user: null, loading: true };
    renderDeck();
    expect(screen.queryByText("Sign in to get your deck")).toBeNull();
    expect(screen.queryByText(/All Caught Up/)).toBeNull();
  });

  it("a signed-in member with an empty deck keeps the existing All Caught Up state", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    renderDeck();
    expect(screen.getByRole("heading", { name: "All Caught Up!" })).toBeInTheDocument();
    expect(screen.queryByText("Sign in to get your deck")).toBeNull();
  });

  it("a signed-in member still gets the deck when there are profiles to show", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [{ user_id: "p1", full_name: "Ada" }], loading: false, error: null };
    renderDeck();
    expect(screen.getByText("card:Ada")).toBeInTheDocument();
    expect(screen.queryByText(/All Caught Up/)).toBeNull();
    expect(screen.queryByText("Sign in to get your deck")).toBeNull();
  });

  it("a signed-in member still sees a load error and the retry", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [], loading: false, error: "Failed to load profiles" };
    renderDeck();
    expect(screen.getByText("Failed to load profiles")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.fetchProfiles).toHaveBeenCalled();
  });
});
