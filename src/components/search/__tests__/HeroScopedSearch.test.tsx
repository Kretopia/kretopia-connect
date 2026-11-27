import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  people: vi.fn(),
  tables: vi.fn(),
  auth: { user: null as null | { id: string }, loading: false },
}));

vi.mock("@/lib/scoutPeopleSearch", () => ({
  SCOUT_PEOPLE_PAGE_SIZE: 50,
  scoutSearchTarget: (q: string) => `/scout?q=${encodeURIComponent(q)}`,
  searchScoutPeople: mocks.people,
}));
/** A chain that accepts any filter call and resolves, once awaited, to what the test gives for that table. */
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = () => Promise.resolve(mocks.tables(table));
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "ilike", "gte", "or", "order"]) chain[m] = () => chain;
      chain.limit = result;
      return chain;
    },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useVoiceSearch", () => ({ useVoiceSearch: () => ({ supported: true, status: "idle", start: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ analytics: { featureUsed: vi.fn() } }));

import { useState } from "react";
import { UnifiedSearchDropdown } from "../UnifiedSearchDropdown";
import { analytics } from "@/lib/analytics";
import { HERO_TOPICS, type SearchScope } from "@/lib/heroSearchScope";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname}{l.search}</output>;
}

function Harness({ initial = "all" as SearchScope }) {
  return (
    <MemoryRouter>
      <UnifiedSearchDropdown variant="hero" intentSearch scopeSearch scope={initial} />
      <Where />
    </MemoryRouter>
  );
}

const where = () => screen.getByTestId("where").textContent;
const type = (value: string) => fireEvent.change(screen.getByRole("combobox"), { target: { value } });
const results = () => screen.getByRole("region", { name: "Search results" });

const ada = { user_id: "p1", full_name: "Ada Lovelace", role: "Motion Designer", location: "Bali", avatar_url: null };
const gig = { id: "g1", title: "Film editor", type: "Paid Job", compensation: null, location: "Remote" };
const jam = { id: "e1", title: "Electronic music night", start_time: "2030-05-01T20:00:00Z", venue_name: "The Loft" };

beforeEach(() => {
  mocks.people.mockReset();
  mocks.tables.mockReset();
  mocks.people.mockResolvedValue({ users: [], hasMore: false });
  mocks.tables.mockImplementation((table: string) => ({ data: table === "opportunities" ? [] : [], error: null }));
  vi.mocked(analytics.featureUsed).mockClear();
  // A member by default: navigation tests. Guests have their own describe below.
  mocks.auth.user = { id: "u1" };
  mocks.auth.loading = false;
  sessionStorage.clear();
});

describe("hero search with a scope (signed in)", () => {
  it("under All it asks people, opportunities and events together and shows each in its own section", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    mocks.tables.mockImplementation((table: string) => ({ data: table === "opportunities" ? [gig] : [jam], error: null }));
    render(<Harness />);
    type("music");
    await waitFor(() => expect(results()).toHaveTextContent("Electronic music night"));
    expect(results()).toHaveTextContent("Ada Lovelace");
    expect(results()).toHaveTextContent("Film editor");
    expect(screen.getByRole("region", { name: "Events" })).toBeInTheDocument();
  });

  it("under Events it asks only events: people and opportunities are never fetched", async () => {
    mocks.tables.mockImplementation((table: string) => ({ data: table === "creative_jams" ? [jam] : [gig], error: null }));
    render(<Harness initial="events" />);
    type("music");
    await waitFor(() => expect(results()).toHaveTextContent("Electronic music night"));
    expect(mocks.people).not.toHaveBeenCalled();
    expect(mocks.tables).toHaveBeenCalledTimes(1);
    expect(mocks.tables).toHaveBeenCalledWith("creative_jams");
    expect(results()).not.toHaveTextContent("Film editor");
  });

  it("choosing an event opens its page", async () => {
    mocks.tables.mockResolvedValue({ data: [jam], error: null });
    render(<Harness initial="events" />);
    type("music");
    fireEvent.click(await screen.findByRole("button", { name: /Electronic music night/ }));
    expect(where()).toBe("/event/e1");
  });

  it("under People it asks only people, under Scout only opportunities", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    const { unmount } = render(<Harness initial="people" />);
    type("ada");
    await waitFor(() => expect(results()).toHaveTextContent("Ada Lovelace"));
    expect(mocks.tables).not.toHaveBeenCalled();
    unmount();

    mocks.people.mockClear();
    mocks.tables.mockResolvedValue({ data: [gig], error: null });
    render(<Harness initial="scout" />);
    type("film");
    await waitFor(() => expect(results()).toHaveTextContent("Film editor"));
    expect(mocks.people).not.toHaveBeenCalled();
    expect(mocks.tables).toHaveBeenCalledWith("opportunities");
  });

  it("under SoundStages nothing is fetched and the search is offered", async () => {
    render(<Harness initial="soundstages" />);
    type("beats");
    fireEvent.click(await screen.findByRole("button", { name: /Search SoundStages for “beats”/ }));
    expect(mocks.people).not.toHaveBeenCalled();
    expect(mocks.tables).not.toHaveBeenCalled();
    expect(where()).toBe("/soundstages?q=beats");
  });

  it("Enter sends the words with the scope, and records which scope was used", () => {
    render(<Harness initial="scout" />);
    type("photographer");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(where()).toBe("/scout?q=photographer");
    expect(analytics.featureUsed).toHaveBeenCalledWith("landing_hero_search", { scope: "scout" });
  });

  it("under All, Enter opens the area that has the only answer", async () => {
    mocks.tables.mockImplementation((table: string) => ({ data: table === "creative_jams" ? [jam] : [], error: null }));
    render(<Harness />);
    // "loft" is in no vocabulary and matches no person or opportunity: only the event answers.
    type("loft");
    await waitFor(() => expect(results()).toHaveTextContent("Electronic music night"));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(where()).toBe("/meetup?q=loft");
  });

  it("calls onQuerySubmit with the scope when the host handles the search itself", () => {
    const onQuerySubmit = vi.fn();
    render(
      <MemoryRouter>
        <UnifiedSearchDropdown variant="hero" intentSearch scopeSearch scope="events" onQuerySubmit={onQuerySubmit} />
      </MemoryRouter>,
    );
    type("jazz");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onQuerySubmit).toHaveBeenCalledWith("jazz", "events");
  });

  it("keeps the microphone next to the clear button once there are words", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Search by voice" })).toBeInTheDocument();
    type("jazz");
    expect(screen.getByRole("button", { name: "Search by voice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });

  it("without scopeSearch the field has no scope and behaves as before", () => {
    render(
      <MemoryRouter>
        <UnifiedSearchDropdown variant="hero" intentSearch />
      </MemoryRouter>,
    );
    expect(document.querySelector("[data-scope-trigger]")).toBeNull();
  });
});

const TopicsHarness = ({ initial = "all" as SearchScope }) => {
  const [scope, setScope] = useState<SearchScope>(initial);
  return (
    <MemoryRouter>
      <UnifiedSearchDropdown variant="hero" intentSearch scopeSearch scopes={HERO_TOPICS} scope={scope} onScopeChange={setScope} />
      <Where />
    </MemoryRouter>
  );
};
const pill = (id: string) => document.querySelector(`[data-scope-pill="${id}"]`) as HTMLElement;

describe("hero search topic labels", () => {
  it("shows All, Scout, People and Match as compact radios on the bar, All selected", () => {
    render(<TopicsHarness />);
    const group = screen.getByRole("radiogroup", { name: "Search topic" });
    const radios = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(radios.map((r) => r.textContent)).toEqual(["All", "Scout", "People", "Match"]);
    expect(pill("all")).toHaveAttribute("aria-checked", "true");
    expect(pill("scout")).toHaveAttribute("aria-checked", "false");
    // Labels, not tabs, cards or pages.
    expect(screen.queryByRole("tab")).toBeNull();
    expect(document.querySelector("[data-scope-trigger]")).toBeNull();
  });

  it("choosing a topic selects it and keeps the words typed", () => {
    render(<TopicsHarness />);
    type("film");
    fireEvent.click(pill("people"));
    expect(pill("people")).toHaveAttribute("aria-checked", "true");
    expect(pill("all")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("combobox")).toHaveValue("film");
  });

  it("the arrow keys move between topics, with one stop in the tab order", () => {
    render(<TopicsHarness />);
    expect(pill("all")).toHaveAttribute("tabindex", "0");
    expect(pill("people")).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(pill("all"), { key: "ArrowRight" });
    expect(pill("scout")).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(pill("scout"), { key: "ArrowLeft" });
    fireEvent.keyDown(pill("all"), { key: "ArrowLeft" });
    expect(pill("match")).toHaveAttribute("aria-checked", "true");
  });

  it("answers inside the one results panel, for every topic", async () => {
    mocks.tables.mockResolvedValue({ data: [gig], error: null });
    render(<TopicsHarness initial="scout" />);
    type("film");
    await waitFor(() => expect(results()).toHaveTextContent("Film editor"));
    expect(screen.getAllByRole("region", { name: "Search results" })).toHaveLength(1);
  });
});

describe("hero search for a guest", () => {
  beforeEach(() => {
    mocks.auth.user = null;
  });

  it("sees that results exist, each marked as needing an account, with one quiet sign-up prompt", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    render(<TopicsHarness initial="people" />);
    type("ada");
    await waitFor(() => expect(results()).toHaveTextContent("Ada Lovelace"));
    expect(screen.getAllByLabelText("Needs an account").length).toBeGreaterThan(0);
    const gate = results().querySelector("[data-search-gate]") as HTMLElement;
    expect(gate).toHaveTextContent("Sign up free to view full results.");
    expect(gate.querySelectorAll("button")).toHaveLength(2);
  });

  it("opens nothing: a result, Enter and the Search button keep the guest on the page and bring up the prompt", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    render(<TopicsHarness initial="people" />);
    type("ada");
    fireEvent.click(await screen.findByRole("button", { name: /Ada Lovelace/ }));
    expect(where()).toBe("/");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(where()).toBe("/");
    fireEvent.click(screen.getByRole("button", { name: /See everyone for/ }));
    expect(where()).toBe("/");
    expect(results().querySelector("[data-search-gate]")).not.toBeNull();
  });

  it("shows no prompt while nothing was found, and does not claim content that is not there", async () => {
    render(<TopicsHarness initial="scout" />);
    type("zzzz");
    await waitFor(() => expect(results()).toHaveTextContent("Nothing matches"));
    expect(results().querySelector("[data-search-gate]")).toBeNull();
  });

  it("Sign up keeps the topic and the words for the app's own post-auth return", async () => {
    mocks.tables.mockResolvedValue({ data: [gig], error: null });
    render(<TopicsHarness initial="scout" />);
    type("film");
    await waitFor(() => expect(results()).toHaveTextContent("Film editor"));
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(where()).toBe("/auth?tab=signup");
    expect(sessionStorage.getItem("thrivein_post_auth_redirect")).toBe("/scout?q=film");
  });

  it("Sign in keeps them the same way, and People and Match return to the Grid with the words", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    render(<TopicsHarness initial="people" />);
    type("ada");
    await waitFor(() => expect(results()).toHaveTextContent("Ada Lovelace"));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(where()).toBe("/auth?tab=signin");
    expect(sessionStorage.getItem("thrivein_post_auth_redirect")).toBe("/match?tab=browse&view=grid&q=ada");
  });

  it("a member is never asked: the same search opens its page", async () => {
    mocks.auth.user = { id: "u1" };
    mocks.tables.mockResolvedValue({ data: [gig], error: null });
    render(<TopicsHarness initial="scout" />);
    type("film");
    await waitFor(() => expect(results()).toHaveTextContent("Film editor"));
    expect(results().querySelector("[data-search-gate]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(where()).toBe("/scout?q=film");
  });
});
