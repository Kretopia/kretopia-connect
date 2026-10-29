import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Scout's layout contract: the same header as Studio (no tab row inside it),
 * the tabs right under it, the results, and only then Kreto's panel. Nothing
 * from the old explainer or the people rail is on this page any more.
 */

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
// If Scout ever mounts the shared proactive cards again, this marker shows up
// (and the watcher spy below is called): the two legacy "Kreto Suggests" cards
// (Set your day rate, N fresh gigs matched you) came from this component.
const watchSpy = vi.fn();
vi.mock("@/hooks/useSurfaceAgentWatch", () => ({ useSurfaceAgentWatch: (surface: string) => watchSpy(surface) }));
vi.mock("@/components/agent/SurfaceProactiveCards", () => ({
  SurfaceProactiveCards: () => {
    watchSpy("scout");
    return <section data-testid="proactive-cards">Kreto Suggests</section>;
  },
}));
vi.mock("@/components/scout/ScoutScanProvider", () => ({ ScoutScanProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/scout/ScoutWrapped", () => ({
  ScoutWrapped: ({ onSelectTab }: { onSelectTab: (tab: string) => void }) => (
    <section aria-label="Scout Wrapped" data-testid="wrapped">
      <button type="button" onClick={() => onSelectTab("shortlist")}>Go to saved</button>
    </section>
  ),
}));
vi.mock("@/components/scout/ScoutResultsWrapped", () => ({
  ScoutResultsWrapped: ({ children, status }: { children: ReactNode; status?: { label: string; active: boolean } }) => (
    <section aria-label="Scout results" data-testid="results-wrapped" data-status={status ? status.label : ""}>{children}</section>
  ),
}));
vi.mock("@/components/scout/ScoutAllSources", () => ({ ScoutAllSources: () => <div data-testid="all-sources" /> }));
vi.mock("@/components/circle/OpportunitiesFeed", () => ({ OpportunitiesFeed: () => <div data-testid="marketplace" /> }));
vi.mock("@/components/opportunity/ScoutedGigsSection", () => ({ ScoutedGigsSection: () => <div data-testid="scouted" /> }));
vi.mock("@/components/opportunity/ShortlistedGigs", () => ({ ShortlistedGigs: () => <div data-testid="shortlist" /> }));

const headerProps: Array<Record<string, unknown>> = [];
vi.mock("@/components/features/FeaturePageHeader", () => ({
  FeaturePageHeader: (props: Record<string, unknown>) => {
    headerProps.push(props);
    return <header data-testid="header">{props.title as ReactNode} {props.accentTitle as ReactNode}</header>;
  },
}));

import Scout from "../Scout";
import { SCOUT_CATALOG_KEY } from "@/hooks/useScoutCatalog";

const gigs = [
  { id: "g1", title: "Motion Designer", company: "Nord", location: "Remote", remote: true, compensation: "$60k / year", fit_score: 88, fit_reason: "Matches your motion", source_name: "Remote OK" },
];

const renderScout = (cached: unknown[] | null = gigs) => {
  const queryClient = new QueryClient();
  if (cached) queryClient.setQueryData(["scouted-gigs", "u1"], cached);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/scout"]}>
        <Scout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const renderAt = (url: string, catalog?: unknown) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["scouted-gigs", "u1"], gigs);
  if (catalog) queryClient.setQueryData(SCOUT_CATALOG_KEY, catalog);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Scout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const assist = () => screen.queryByRole("complementary", { name: "Kreto can help" });

beforeEach(() => watchSpy.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("Scout page", () => {
  it("uses the Studio header: tutorial slot, no tabs inside the header, a promise to filter and chat", () => {
    renderScout();
    const props = headerProps.at(-1)!;
    expect(props.eyebrow).toBe("Scout");
    expect(props.tabs).toBeUndefined();
    expect((props.tutorial as { featureKey: string }).featureKey).toBe("scout");
    expect(String(props.subtitle)).toMatch(/filter the noise and shortlist real fits/i);
    expect(String(props.subtitle)).toMatch(/just chat with Kreto/i);
  });

  it("order: header, then Scout's Wrapped surface, then the tabs right under it, then the results, then Kreto", () => {
    renderScout();
    const wrapped = screen.getByTestId("wrapped");
    const tabs = screen.getByRole("tablist", { name: "Scout sections" });
    const results = screen.getByTestId("scouted");
    const kreto = assist()!;
    expect(before(screen.getByTestId("header"), wrapped)).toBe(true);
    expect(before(wrapped, tabs)).toBe(true);
    // the bottom of the page is one Wrapped panel, right after the top one, and the tabs open it
    const bottom = screen.getByTestId("results-wrapped");
    expect(wrapped.nextElementSibling).toBe(bottom);
    expect(bottom.firstElementChild).toBe(tabs);
    expect(bottom.contains(results)).toBe(true);
    expect(bottom.contains(kreto)).toBe(true);
    expect(before(tabs, results)).toBe(true);
    expect(before(results, kreto)).toBe(true);
    expect(screen.getAllByRole("complementary", { name: "Kreto can help" })).toHaveLength(1);
  });

  it("Kreto's panel says one thing, promises only a draft for review, and has one action", () => {
    renderScout();
    const panel = assist()!;
    expect(panel).toHaveTextContent("Found one worth pursuing?");
    expect(panel).toHaveTextContent("Kreto can prepare a draft pitch for your review.");
    expect(panel).not.toHaveTextContent(/sent|submitted|applied|already/i);
    expect(panel.querySelectorAll("button")).toHaveLength(1);
    expect(panel.querySelectorAll("a")).toHaveLength(0);
    // the K-mark, not a robot illustration
    expect(panel.querySelector('img[src*="kretopia-k-mark"]')).toBeInTheDocument();
  });

  it("'Ask Kreto' opens Kreto with the pitch prompt and the gigs on screen, and nothing else", () => {
    const events: CustomEvent[] = [];
    window.addEventListener("thrive-copilot:open", (e) => events.push(e as CustomEvent), { once: true });
    renderScout();
    fireEvent.click(screen.getByRole("button", { name: "Ask Kreto" }));
    expect(events).toHaveLength(1);
    const prompt = String(events[0].detail.prompt);
    expect(prompt).toContain("Help me draft a pitch for the opportunity I'm looking at");
    expect(prompt).toContain("Gigs currently on my Scout list:");
    expect(prompt).toContain("1. Motion Designer at Nord");
  });

  it("waits for something to act on: no panel on For You while there are no gigs", () => {
    renderScout([]);
    expect(assist()).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /All open gigs on Kretopia/i }));
    expect(assist()).not.toBeNull();
  });

  it("has an All Sources tab right after For You, which opens the catalog inside the results panel", () => {
    renderScout();
    const tabs = within(screen.getByRole("tablist", { name: "Scout sections" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["For You", "All Sources", "Open Gigs", "Shortlist"]);
    expect(screen.queryByTestId("all-sources")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /every opportunity from every source/i }));
    expect(screen.getByTestId("all-sources")).toBeInTheDocument();
    expect(screen.queryByTestId("scouted")).not.toBeInTheDocument();
    expect(screen.getByTestId("results-wrapped").contains(screen.getByTestId("all-sources"))).toBe(true);
  });

  it("?tab=all opens it directly, and its status line counts the catalog it reads from the cache", () => {
    const { unmount } = renderAt("/scout?tab=all");
    expect(screen.getByTestId("all-sources")).toBeInTheDocument();
    expect(screen.getByTestId("results-wrapped")).toHaveAttribute("data-status", "Every source, sorted");
    unmount();
    renderAt("/scout?tab=all", { items: [{}, {}, {}], partial: false });
    expect(screen.getByTestId("results-wrapped")).toHaveAttribute("data-status", "3 opportunities from every source");
  });

  it("the other tabs keep the list's own status line", () => {
    renderScout();
    expect(screen.getByTestId("results-wrapped")).toHaveAttribute("data-status", "");
  });

  it("no longer carries the old explainer, the warm-intro block or the people rail", () => {
    renderScout();
    for (const gone of [/warm intro beats a cold application/i, /Most creatives land work/i, /How scouting works/i, /Scout checks remote job boards/i, /Discover Creatives/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("never renders the legacy Kreto Suggests cards, on any tab, and never starts the surface watcher", () => {
    renderScout();
    for (const id of ["marketplace", "shortlist"] as const) {
      const tab = id === "marketplace" ? /All open gigs on Kretopia/i : /Gigs you saved for later/i;
      fireEvent.click(screen.getByRole("tab", { name: tab }));
    }
    expect(screen.queryByTestId("proactive-cards")).not.toBeInTheDocument();
    for (const gone of [/Kreto Suggests/i, /Set your day rate/i, /Set rate/i, /fresh gigs? matched you/i, /Not now/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
    expect(watchSpy).not.toHaveBeenCalled();
  });

  it("the Wrapped surface can switch the page to a tab", async () => {
    renderScout();
    fireEvent.click(screen.getByRole("button", { name: "Go to saved" }));
    expect(await screen.findByTestId("shortlist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Gigs you saved for later/i })).toHaveAttribute("aria-selected", "true");
  });

  it("switches sections from the body", async () => {
    renderScout();
    fireEvent.click(screen.getByRole("tab", { name: /All open gigs on Kretopia/i }));
    expect(await screen.findByTestId("marketplace")).toBeInTheDocument();
  });
});
