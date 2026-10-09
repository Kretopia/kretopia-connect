import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Scout's layout contract: the same header as Studio (no tab row inside it),
 * then the Kreto card first in the body, then the section switcher, then the
 * work. Everything heavy is stubbed; this is about order and wiring.
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

let tipProps: Record<string, unknown> | null = null;
vi.mock("@/components/agent/KretoTip", () => ({
  KretoTip: (props: Record<string, unknown>) => {
    tipProps = props;
    return <aside data-testid="kreto-tip" />;
  },
}));

import Scout from "../Scout";

const renderScout = (queryClient = new QueryClient()) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/scout"]}>
        <Scout />
      </MemoryRouter>
    </QueryClientProvider>,
  );

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

  it("puts Kreto first in the body, then the section switcher, then the gigs", () => {
    renderScout();
    const tip = screen.getByTestId("kreto-tip");
    const tabs = screen.getByRole("tablist", { name: "Scout sections" });
    const gigs = screen.getByTestId("scouted");
    const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(screen.getByTestId("header"), tip)).toBe(true);
    expect(before(tip, tabs)).toBe(true);
    expect(before(tabs, gigs)).toBe(true);
    // and it appears once, not again at the bottom
    expect(screen.getAllByTestId("kreto-tip")).toHaveLength(1);
  });

  it("hands Kreto the list the person is looking at when they ask it to shortlist", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["scouted-gigs", "u1"], [
      { id: "g1", title: "Motion Designer", company: "Nord", location: "Remote", remote: true, compensation: "$60k / year", fit_score: 88, fit_reason: "Matches your motion", source_name: "Remote OK" },
    ]);
    renderScout(queryClient);
    const context = (tipProps!.getPromptContext as () => string)();
    expect(context).toContain("Gigs currently on my Scout list:");
    expect(context).toContain("1. Motion Designer at Nord");
    expect(context).toContain("fit 88%");
  });

  it("adds nothing when there is no list yet", () => {
    renderScout();
    expect((tipProps!.getPromptContext as () => string)()).toBe("");
  });

  it("switches sections from the body", async () => {
    renderScout();
    screen.getByRole("tab", { name: /All open gigs on Kretopia/i }).click();
    expect(await screen.findByTestId("marketplace")).toBeInTheDocument();
  });
});
