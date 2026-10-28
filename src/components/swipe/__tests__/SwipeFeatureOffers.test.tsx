import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

/**
 * The Match deck with offers found outside Kretopia in it: people stay the deck, an offer comes up between them, and answering an
 * offer is a different thing from answering a person: no swipe on a profile, no notification, no match.
 */
const state = vi.hoisted(() => ({
  auth: { user: { id: "u1" } as null | { id: string }, loading: false },
  people: [] as { user_id: string; full_name: string }[],
  offers: [] as Record<string, unknown>[],
  recordSwipe: vi.fn(),
  resolve: vi.fn(),
  restore: vi.fn(),
  enabledSeen: [] as boolean[],
  toastSuccess: vi.fn(),
  invoke: vi.fn(),
  windowOpen: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/useSwipeProfiles", async () => {
  const React = await import("react");
  return {
    useSwipeProfiles: () => {
      const [profiles, setProfiles] = React.useState(() => state.people);
      const removed = React.useRef<typeof state.people>([]);
      return {
        profiles,
        allProfilesCount: profiles.length,
        loading: false,
        error: null,
        // like the real hook after an Undo: the last person answered comes back to the front of the deck
        fetchProfiles: () => { const back = removed.current.pop(); if (back) setProfiles((p) => [back, ...p]); },
        removeProfile: (id: string) => setProfiles((p) => { const gone = p.find((x) => x.user_id === id); if (gone) removed.current.push(gone); return p.filter((x) => x.user_id !== id); }),
      };
    },
  };
});
vi.mock("@/hooks/useSwipeActions", () => ({ useSwipeActions: () => ({ recordSwipe: state.recordSwipe }) }));
vi.mock("@/hooks/useExternalOffers", async () => {
  const React = await import("react");
  return {
    useExternalOffers: (_userId: string | undefined, enabled: boolean) => {
      state.enabledSeen.push(enabled);
      const [offers, setOffers] = React.useState<Record<string, unknown>[]>(() => state.offers);
      return {
        offers: enabled ? offers : [],
        resolve: async (offer: { id: string }, direction: string) => { state.resolve(offer, direction); setOffers((o) => o.filter((x) => x.id !== offer.id)); return true; },
        restore: async (offer: Record<string, unknown>) => { state.restore(offer); setOffers((o) => [offer, ...o]); },
      };
    },
  };
});
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: (...a: unknown[]) => state.toastSuccess(...a) }) }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "single", "maybeSingle", "delete"]) chain[m] = () => chain;
  chain.then = (resolve: (v: { data: null; count: number; error: null }) => unknown) => resolve({ data: null, count: 0, error: null });
  return { supabase: { from: () => chain, functions: { invoke: (...a: unknown[]) => state.invoke(...a) } } };
});
vi.mock("../MatchModal", () => ({ MatchModal: () => null }));
vi.mock("../ProfilePreviewSheet", () => ({ ProfilePreviewSheet: () => null }));
vi.mock("@/components/discover/MatchExplanationDialog", () => ({ MatchExplanationDialog: () => null }));
vi.mock("@/lib/profileCompletion", () => ({ getDiscoveryMissingFields: () => [] }));
vi.mock("@/components/discover/HingeStyleCard", () => ({
  HingeStyleCard: ({ profile, onLike, onPass }: { profile: { full_name: string }; onLike: (p: unknown, c: unknown) => void; onPass: (p: unknown) => void }) => (
    <div>
      <p>card:{profile.full_name}</p>
      <button onClick={() => onLike(profile, { type: "profile", label: "their profile" })}>like {profile.full_name}</button>
      <button onClick={() => onPass(profile)}>pass {profile.full_name}</button>
    </div>
  ),
}));
vi.mock("../ExternalOfferCard", () => ({
  ExternalOfferCard: ({ offer, onInterested, onPass }: { offer: { title: string }; onInterested: (o: unknown) => void; onPass: (o: unknown) => void }) => (
    <div>
      <p>offer:{offer.title}</p>
      <button onClick={() => onInterested(offer)}>interested in {offer.title}</button>
      <button onClick={() => onPass(offer)}>pass offer {offer.title}</button>
    </div>
  ),
}));

import { SwipeFeature } from "../SwipeFeature";

const person = (n: string) => ({ user_id: `p-${n}`, full_name: n });
const offer = (id: string) => ({ id, title: `Offer ${id}`, apply_url: `https://acme.example/${id}` });
const renderDeck = (offers = true) => render(<MemoryRouter><SwipeFeature offers={offers} /></MemoryRouter>);
const answerPerson = (name: string) => fireEvent.click(screen.getByRole("button", { name: `pass ${name}` }));

beforeEach(() => {
  state.auth = { user: { id: "u1" }, loading: false };
  state.people = ["Ada", "Bo", "Cy", "Di", "Ed", "Flo"].map(person);
  state.offers = [offer("o1"), offer("o2")];
  state.recordSwipe.mockReset();
  state.resolve.mockReset();
  state.restore.mockReset();
  state.toastSuccess.mockReset();
  state.invoke.mockReset();
  state.enabledSeen.length = 0;
  vi.stubGlobal("open", state.windowOpen);
  state.windowOpen.mockReset();
});

describe("Match deck with offers: the order", () => {
  it("people first, then an offer after four people are answered, then people again", async () => {
    renderDeck();
    for (const name of ["Ada", "Bo", "Cy", "Di"]) {
      expect(screen.getByText(`card:${name}`)).toBeInTheDocument();
      expect(screen.queryByText(/^offer:/)).not.toBeInTheDocument();
      answerPerson(name);
    }
    expect(await screen.findByText("offer:Offer o1")).toBeInTheDocument();
    expect(screen.queryByText(/^card:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "pass offer Offer o1" }));
    expect(await screen.findByText("card:Ed")).toBeInTheDocument();
  });

  it("without the offers switch the deck is people only, and the offers are never even requested", () => {
    renderDeck(false);
    expect(state.enabledSeen.every((e) => e === false)).toBe(true);
    for (const name of ["Ada", "Bo", "Cy", "Di", "Ed"]) { expect(screen.getByText(`card:${name}`)).toBeInTheDocument(); answerPerson(name); }
    expect(screen.queryByText(/^offer:/)).not.toBeInTheDocument();
  });

  it("when only offers are left they are shown, not 'All Caught Up'", () => {
    state.people = [];
    renderDeck();
    expect(screen.getByText("offer:Offer o1")).toBeInTheDocument();
    expect(screen.queryByText(/All Caught Up/)).not.toBeInTheDocument();
  });

  it("with nothing at all the existing 'All Caught Up' state shows", () => {
    state.people = [];
    state.offers = [];
    renderDeck();
    expect(screen.getByRole("heading", { name: "All Caught Up!" })).toBeInTheDocument();
  });

  it("the counter says how many offers found outside Kretopia are in the deck, and nothing when there are none", () => {
    const { unmount } = renderDeck();
    expect(screen.getByText(/6 creators to discover · 2 offers found outside Kretopia/)).toBeInTheDocument();
    unmount();
    state.offers = [];
    renderDeck();
    expect(screen.getByText(/^6 creators to discover$/)).toBeInTheDocument();
  });
});

describe("Match deck with offers: answering an offer", () => {
  const reachOffer = async (title = "Offer o1") => {
    for (const name of ["Ada", "Bo", "Cy", "Di"]) answerPerson(name);
    await screen.findByText(`offer:${title}`);
    state.recordSwipe.mockClear();
  };

  it("'interested' keeps it: one saved answer, a toast that says nothing was sent with an Open action, and no person is swiped", async () => {
    renderDeck();
    await reachOffer();
    fireEvent.click(screen.getByRole("button", { name: "interested in Offer o1" }));
    await waitFor(() => expect(state.resolve).toHaveBeenCalledWith(expect.objectContaining({ id: "o1" }), "right"));
    const [title, opts] = state.toastSuccess.mock.calls.at(-1)!;
    expect(title).toBe("Kept for you");
    expect(opts.description).toMatch(/nothing was sent to anyone/i);
    expect(state.recordSwipe).not.toHaveBeenCalled(); // no swipe on a profile
    expect(state.invoke).not.toHaveBeenCalled(); // no notification function
    expect(state.windowOpen).not.toHaveBeenCalled(); // nothing opens by itself
    opts.action.onClick();
    expect(state.windowOpen).toHaveBeenCalledWith("https://acme.example/o1", "_blank", "noopener,noreferrer");
  });

  it("'pass' passes on it, without a toast and without touching a profile", async () => {
    renderDeck();
    await reachOffer();
    fireEvent.click(screen.getByRole("button", { name: "pass offer Offer o1" }));
    await waitFor(() => expect(state.resolve).toHaveBeenCalledWith(expect.objectContaining({ id: "o1" }), "left"));
    expect(state.toastSuccess).not.toHaveBeenCalled();
    expect(state.recordSwipe).not.toHaveBeenCalled();
    expect(state.invoke).not.toHaveBeenCalled();
  });

  it("an offer with no destination keeps without an 'Open' action", async () => {
    state.offers = [{ id: "o9", title: "Offer o9", apply_url: null }];
    renderDeck();
    await reachOffer("Offer o9");
    fireEvent.click(screen.getByRole("button", { name: "interested in Offer o9" }));
    await waitFor(() => expect(state.toastSuccess).toHaveBeenCalled());
    expect(state.toastSuccess.mock.calls.at(-1)![1].action).toBeUndefined();
  });

  it("the next offer waits for four more people, not for the next card", async () => {
    renderDeck();
    await reachOffer();
    fireEvent.click(screen.getByRole("button", { name: "pass offer Offer o1" }));
    expect(await screen.findByText("card:Ed")).toBeInTheDocument();
    answerPerson("Ed");
    expect(await screen.findByText("card:Flo")).toBeInTheDocument();
    answerPerson("Flo");
    // no people left: the remaining offer is shown rather than 'All Caught Up'
    expect(await screen.findByText("offer:Offer o2")).toBeInTheDocument();
  });

  it("Undo of a person answered after an offer does not bring the next offer a card early", async () => {
    state.people = ["Ada", "Bo", "Cy", "Di", "Ed", "Flo", "Gus", "Hal", "Ivy", "Jo"].map(person);
    renderDeck();
    await reachOffer();                                                          // four people answered: offer o1
    fireEvent.click(screen.getByRole("button", { name: "pass offer Offer o1" })); // zero people since an offer
    answerPerson("Ed");                                                          // 1
    answerPerson("Flo");                                                         // 2
    await screen.findByText("card:Gus");
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));              // Flo is back: 1
    await screen.findByText("card:Flo");
    answerPerson("Flo");                                                         // 2
    answerPerson("Gus");                                                         // 3: still a person (an offer here would be one card early)
    expect(await screen.findByText("card:Hal")).toBeInTheDocument();
    expect(screen.queryByText(/^offer:/)).not.toBeInTheDocument();
    answerPerson("Hal");                                                         // 4: now the offer
    expect(await screen.findByText("offer:Offer o2")).toBeInTheDocument();
  });

  it("Undo takes an answered offer back, and it is the next card again", async () => {
    renderDeck();
    await reachOffer();
    fireEvent.click(screen.getByRole("button", { name: "pass offer Offer o1" }));
    await screen.findByText("card:Ed");
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    await waitFor(() => expect(state.restore).toHaveBeenCalledWith(expect.objectContaining({ id: "o1" })));
    expect(await screen.findByText("offer:Offer o1")).toBeInTheDocument();
  });
});

describe("Match deck with offers: people are answered exactly as before", () => {
  it("liking a person still records a right swipe on that profile, and an offer in between changes nothing about it", async () => {
    state.recordSwipe.mockResolvedValue({ success: true, isMatch: false });
    renderDeck();
    fireEvent.click(screen.getByRole("button", { name: "like Ada" }));
    await waitFor(() => expect(state.recordSwipe).toHaveBeenCalledWith("p-Ada", "right"));
    fireEvent.click(screen.getByRole("button", { name: "pass Bo" }));
    await waitFor(() => expect(state.recordSwipe).toHaveBeenCalledWith("p-Bo", "left"));
    expect(state.resolve).not.toHaveBeenCalled();
  });
});
