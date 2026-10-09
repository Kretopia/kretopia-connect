import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Scout's layout contract: the same header as Studio (no tab row inside it),
 * the tabs right under it, the results, and only then Kreto's panel. Nothing
 * from the old explainer or the people rail is on this page any more.
 */

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/agent/SurfaceProactiveCards", () => ({ SurfaceProactiveCards: () => null }));
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

const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const assist = () => screen.queryByRole("complementary", { name: "Kreto can help" });

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

  it("order: header, then the tabs, then the results, then Kreto, never Kreto above the tabs", () => {
    renderScout();
    const tabs = screen.getByRole("tablist", { name: "Scout sections" });
    const results = screen.getByTestId("scouted");
    const kreto = assist()!;
    expect(before(screen.getByTestId("header"), tabs)).toBe(true);
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

  it("no longer carries the old explainer, the warm-intro block or the people rail", () => {
    renderScout();
    for (const gone of [/warm intro beats a cold application/i, /Most creatives land work/i, /How scouting works/i, /Scout checks remote job boards/i, /Discover Creatives/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("switches sections from the body", async () => {
    renderScout();
    fireEvent.click(screen.getByRole("tab", { name: /All open gigs on Kretopia/i }));
    expect(await screen.findByTestId("marketplace")).toBeInTheDocument();
  });
});
