import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { user: null as null | { id: string }, loading: false },
  deck: { profiles: [] as unknown[], loading: false, refreshing: false, error: null as string | null },
  navigate: vi.fn(),
  fetchProfiles: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/useSwipeProfiles", () => ({
  useSwipeProfiles: () => ({
    profiles: state.deck.profiles,
    allProfilesCount: state.deck.profiles.length,
    loading: state.deck.loading,
    refreshing: state.deck.refreshing,
    error: state.deck.error,
    fetchProfiles: state.fetchProfiles,
    removeProfile: vi.fn(),
  }),
}));
vi.mock("@/hooks/useSwipeActions", () => ({ useSwipeActions: () => ({ recordSwipe: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  for (const m of ["select", "eq", "single", "maybeSingle"]) chain[m] = () => chain;
  chain.then = (resolve: (v: { data: unknown; count: number; error: null }) => unknown) => resolve({ data: { full_name: "New member", avatar_url: null, bio: null }, count: 0, error: null });
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
  state.deck = { profiles: [], loading: false, refreshing: false, error: null };
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
    expect(state.navigate).toHaveBeenLastCalledWith("/match?tab=browse&view=grid");
  });

  it("while the session is still loading it shows neither message", () => {
    state.auth = { user: null, loading: true };
    renderDeck();
    expect(screen.queryByText("Sign in to get your deck")).toBeNull();
    expect(screen.queryByText(/All Caught Up/)).toBeNull();
  });

  it("a deck with nobody to show says so in the card's own voice and offers an invitation, not a repeat of Scan or Grid", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    renderDeck();
    expect(screen.getByRole("article", { name: "Everyone available is already in your circle" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Invite a creative" })).toBeVisible();
    expect(screen.queryByText(/All Caught Up/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Scan now" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Browse the grid" })).toBeNull();
  });

  it("an empty deck that is on its way (a scan, a top-up, the end of a round) is a wait, not an empty deck", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [], loading: false, refreshing: true, error: null };
    renderDeck();
    const card = screen.getByRole("article", { name: "Lining up your next matches" });
    expect(card).toBeVisible();
    expect(card.closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Invite a creative" })).toBeNull();
  });

  it("while the deck loads the card is a complete Kretopia card: brand, scene, three steps and a true tip", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [], loading: true, refreshing: true, error: null };
    renderDeck();
    const card = screen.getByRole("article", { name: "Finding your people" });
    expect(card.querySelector("[data-match-scene]")).not.toBeNull();
    expect(card.querySelector("[data-match-progress]")).not.toBeNull();
    for (const step of ["Reading Passports", "Matching by craft and city", "Lining up your deck"]) expect(screen.getByText(step)).toBeInTheDocument();
    expect(card.querySelector("[data-match-tip]")?.textContent).toMatch(/real Passport/);
    expect(screen.getByText("People. Possibilities.")).toBeInTheDocument();
  });

  it("when the deck has run out of new people it says which round it is in, and keeps offering someone", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [{ user_id: "p1", full_name: "Ada", _deckTier: "passed" }], loading: false, refreshing: false, error: null };
    renderDeck();
    expect(screen.getByText("card:Ada")).toBeInTheDocument();
    expect(screen.getByText(/You've met everyone new/)).toBeInTheDocument();
  });

  it("people who were already sent interest come back last, and are labelled as waiting", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [{ user_id: "p1", full_name: "Ada", _deckTier: "second" }], loading: false, refreshing: false, error: null };
    renderDeck();
    expect(screen.getByText(/Interest already sent/)).toBeInTheDocument();
  });

  it("counts only the people you have not answered as 'to discover'", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [{ user_id: "p1", full_name: "Ada", _deckTier: "fresh" }, { user_id: "p2", full_name: "Bo", _deckTier: "fresh" }], loading: false, refreshing: false, error: null };
    renderDeck();
    expect(screen.getByText(/2 creators to discover/)).toBeInTheDocument();
  });

  it("a signed-in member still gets the deck when there are profiles to show", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [{ user_id: "p1", full_name: "Ada" }], loading: false, refreshing: false, error: null };
    renderDeck();
    expect(screen.getByText("card:Ada")).toBeInTheDocument();
    expect(screen.queryByText(/All Caught Up/)).toBeNull();
    expect(screen.queryByText("Sign in to get your deck")).toBeNull();
  });

  it("a signed-in member still sees a load error and the retry", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    state.deck = { profiles: [], loading: false, refreshing: false, error: "Failed to load profiles" };
    renderDeck();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.fetchProfiles).toHaveBeenCalled();
  });
});
