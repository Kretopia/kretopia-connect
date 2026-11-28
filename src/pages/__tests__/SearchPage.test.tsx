import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  auth: { user: null as null | { id: string } },
  connections: vi.fn(),
  saved: vi.fn(),
}));

vi.mock("@/lib/publicSearch", async (importActual) => ({ ...(await importActual<typeof import("@/lib/publicSearch")>()), fetchPublicSearch: mocks.fetch }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/analytics", () => ({ analytics: { featureUsed: vi.fn() } }));
vi.mock("@/components/SEO", () => ({ SEO: ({ title }: { title: string }) => <title>{title}</title> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "or", "eq", "in"]) chain[m] = () => chain;
      chain.then = (resolve: (v: unknown) => void) => resolve(table === "connections" ? mocks.connections() : mocks.saved());
      return chain;
    },
  },
}));

import SearchPage from "../SearchPage";
import { analytics } from "@/lib/analytics";
import type { PublicSearchResult } from "@/lib/publicSearch";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname}{l.search}</output>;
}

const renderPage = (url: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <SearchPage />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const person = (id: string, title: string, extra: Partial<PublicSearchResult> = {}): PublicSearchResult => ({ type: "creator", id, title, subtitle: "Photographer · Bali", thumbnail: `https://img.test/${id}.jpg`, why: "Role: Photographer", detail: "Editorial and fashion photographer.", ...extra });
const gig = (id: string, title: string, extra: Partial<PublicSearchResult> = {}): PublicSearchResult => ({ type: "gig", id, title, subtitle: "Paid Job · Bali", thumbnail: "https://img.test/g.jpg", why: "Title match", timing: "Apply by 5 Oct", ...extra });
const work = (id: string, title: string): PublicSearchResult => ({ type: "credit", id, title, subtitle: "Commercial · 2025", detail: "2 credits on Kretopia" });
const jam = (id: string, title: string): PublicSearchResult => ({ type: "event", id, title, subtitle: "5 Oct · The Loft" });
const empty = { people: [], opportunities: [], work: [], events: [] };

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.fetch.mockResolvedValue(empty);
  mocks.auth.user = null;
  mocks.connections.mockReset().mockReturnValue({ data: [], error: null });
  mocks.saved.mockReset().mockReturnValue({ data: [], error: null });
  vi.mocked(analytics.featureUsed).mockClear();
});

describe("the Search Page", () => {
  it("keeps the query visible and editable, with a neutral summary and the families offered concisely", async () => {
    mocks.fetch.mockResolvedValue({ ...empty, people: [person("p1", "Ada Lovelace")] });
    renderPage("/search?q=photographer");
    expect(screen.getByRole("searchbox", { name: /Search creatives, skills or opportunities/ })).toHaveValue("photographer");
    expect(await screen.findByTestId("search-summary")).toHaveTextContent("Results for “photographer”");
    expect(screen.getByTestId("search-summary")).toHaveTextContent("1 result");
    const family = screen.getByRole("radiogroup", { name: "Search in" });
    expect(Array.from(family.querySelectorAll('[role="radio"]')).map((r) => r.textContent)).toEqual(["All", "Opportunities", "People", "Roles & skills", "Work", "Events"]);
    expect(document.title).toContain("Results for “photographer”");
  });

  it("groups results in the spec's order, each row a real link to its public page with its miniature, evidence and next action", async () => {
    mocks.fetch.mockResolvedValue({
      people: [person("p1", "Ada Lovelace")],
      opportunities: [gig("g1", "Hotel Campaign Bali")],
      work: [work("w1", "Hotel Campaign Bali")],
      events: [jam("e1", "Night Market")],
    });
    renderPage("/search?q=bali");
    await screen.findByRole("region", { name: "Opportunities" });
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Opportunities", "People", "Work", "Events"]);

    const opp = screen.getByRole("link", { name: /Hotel Campaign Bali.*Paid Job/ });
    expect(opp).toHaveAttribute("href", "/opportunity/g1");
    expect(opp).toHaveTextContent("Apply by 5 Oct");
    expect(opp).toHaveTextContent("View opportunity");
    expect(opp.querySelector("img")).toHaveAttribute("src", "https://img.test/g.jpg");

    const ada = screen.getByRole("link", { name: /Ada Lovelace/ });
    expect(ada).toHaveAttribute("href", "/profile/p1");
    expect(ada).toHaveTextContent("Role: Photographer");
    expect(ada).toHaveTextContent("View profile");

    expect(screen.getByRole("link", { name: /Night Market/ })).toHaveAttribute("href", "/event/e1");
    expect(screen.getByRole("link", { name: /2 credits on Kretopia/ })).toHaveAttribute("href", "/production?name=Hotel%20Campaign%20Bali");
  });

  it("needs no account: a visitor sees every row and nothing asks to sign up", async () => {
    mocks.fetch.mockResolvedValue({ ...empty, people: [person("p1", "Ada Lovelace")], opportunities: [gig("g1", "Film editor")] });
    renderPage("/search?q=film");
    await screen.findByRole("region", { name: "People" });
    expect(screen.queryByText(/sign up/i)).toBeNull();
    expect(screen.queryByLabelText("Needs an account")).toBeNull();
  });

  it("offers a way in when there are no words yet, with real example searches, and fetches nothing", () => {
    renderPage("/search");
    expect(screen.getByText("What are you looking for?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find a film editor" })).toHaveAttribute("href", "/search?q=film+editor");
    expect(mocks.fetch).not.toHaveBeenCalled();
    cleanup();
  });

  it("opens narrowed to the hero's topic: Scout is Opportunities, and only that family is asked", async () => {
    renderPage("/search?q=editor&scope=scout");
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(screen.getByRole("radio", { name: "Opportunities" })).toHaveAttribute("aria-checked", "true");
    const sources = mocks.fetch.mock.calls[0][1];
    expect(sources).toMatchObject({ opportunities: true, people: false, work: false, events: false });
  });

  it("choosing a family narrows the page and keeps the words in the address", async () => {
    renderPage("/search?q=editor");
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("radio", { name: "People" }));
    expect(screen.getByTestId("where").textContent).toBe("/search?q=editor&scope=people");
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    expect(mocks.fetch.mock.calls[1][1]).toMatchObject({ people: true, opportunities: false });
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(screen.getByTestId("where").textContent).toBe("/search?q=editor");
  });

  it("a new search from the field replaces the words and keeps the family", async () => {
    renderPage("/search?q=editor&scope=people");
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "colorist" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByTestId("where").textContent).toBe("/search?q=colorist&scope=people");
  });

  it("answers a role or skill from the vocabulary with a way to meet the professionals", async () => {
    renderPage("/search?q=colorist");
    const group = await screen.findByRole("region", { name: "Roles & skills" });
    const link = within(group).getByRole("link", { name: /Colorists/ });
    expect(link).toHaveAttribute("href", "/match?tab=browse&view=grid&q=Colorist");
  });

  it("is truthful when nothing matches, and offers adjacent next steps", async () => {
    renderPage("/search?q=Editorial%20Motion%20Designer%20Penang");
    await screen.findByText(/We couldn’t find an exact match for “Editorial Motion Designer Penang”/);
    expect(screen.getByRole("link", { name: /Explore people for/ })).toHaveAttribute("href", "/match?tab=browse&view=grid&q=Editorial%20Motion%20Designer%20Penang");
    expect(screen.getByRole("link", { name: /See related opportunities/ })).toHaveAttribute("href", "/scout?q=Editorial%20Motion%20Designer%20Penang");
    expect(screen.getByRole("link", { name: /Try a broader search: “Editorial Motion Designer”/ })).toHaveAttribute("href", "/search?q=Editorial+Motion+Designer");
    expect(screen.queryByTestId("search-summary")?.textContent).not.toMatch(/result/);
  });

  it("says so when the search could not finish, and tries again", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("down"));
    renderPage("/search?q=film");
    expect(await screen.findByText("The search could not finish")).toBeInTheDocument();
    mocks.fetch.mockResolvedValue({ ...empty, opportunities: [gig("g1", "Film editor")] });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Film editor/ })).toBeInTheDocument();
  });

  it("a closed opportunity says so", async () => {
    mocks.fetch.mockResolvedValue({ ...empty, opportunities: [gig("g1", "Old call", { timing: "Deadline passed 1 Jan", closed: true })] });
    renderPage("/search?q=call");
    expect(await screen.findByText("Deadline passed 1 Jan")).toBeInTheDocument();
  });

  it("measures the family, the kind of query and the size of each group, never the words", async () => {
    mocks.fetch.mockResolvedValue({ ...empty, people: [person("p1", "Ethan Auguste")] });
    renderPage("/search?q=Ethan%20Auguste");
    await screen.findByRole("region", { name: "People" });
    const calls = vi.mocked(analytics.featureUsed).mock.calls;
    expect(calls).toContainEqual(["search_page_results", { family: "all", class: "exact_person", people: 1, opportunities: 0, work: 0, events: 0, roles: 0 }]);
    expect(JSON.stringify(calls)).not.toContain("Ethan");
    fireEvent.click(document.querySelector('[data-result-kind="person"]') as HTMLElement);
    expect(vi.mocked(analytics.featureUsed).mock.calls).toContainEqual(["search_page_result_click", { family: "all", group: "people" }]);
  });

  it("a member sees the same rows, marked with what is theirs: connected people, saved opportunities", async () => {
    mocks.auth.user = { id: "u1" };
    mocks.fetch.mockResolvedValue({ ...empty, people: [person("p1", "Ada Lovelace"), person("p2", "Grace Hopper")], opportunities: [gig("g1", "Film editor")] });
    mocks.connections.mockReturnValue({ data: [{ user_id: "u1", connected_user_id: "p1" }], error: null });
    mocks.saved.mockReturnValue({ data: [{ opportunity_id: "g1" }], error: null });
    renderPage("/search?q=ada");
    await screen.findByText("Connected");
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getAllByText("Connected")).toHaveLength(1);
  });

  it("a visitor makes neither of the member's reads", async () => {
    mocks.fetch.mockResolvedValue({ ...empty, people: [person("p1", "Ada Lovelace")] });
    renderPage("/search?q=ada");
    await screen.findByRole("region", { name: "People" });
    expect(mocks.connections).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
  });
});

function cleanup() {
  /* the testing library unmounts after each test */
}
