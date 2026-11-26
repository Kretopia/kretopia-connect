import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Match has three sections: Browse (the deck), Grid (the searchable grid, a second view of Browse) and Connected. Directory,
// Interested and Sent interests are gone -- see src/lib/matchSections.ts.
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => null }));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({ StudioFeatureShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/swipe", () => ({ MatchDeck: () => <p>the deck</p> }));
vi.mock("@/components/swipe/MatchPulse", () => ({ MatchPulse: () => null }));
vi.mock("@/components/discover/BrowseCreators", () => ({ BrowseCreators: () => <p>the grid</p> }));
vi.mock("@/components/circle/ConnectedCollaborators", () => ({ ConnectedCollaborators: () => <p>accepted connections</p> }));
import Match from "../Match";

const Where = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
};
const draw = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Match />
    <Where />
  </MemoryRouter>,
);
const click = (role: string, name: string) => fireEvent.mouseDown(screen.getByRole(role, { name }), { button: 0, ctrlKey: false });

describe("Match: Browse, Grid and Connected, and nothing else", () => {
  it("offers exactly three sections", () => {
    draw("/match");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Browse", "Grid", "Connected"]);
    for (const gone of ["Directory", "Interested", "Sent interests"]) {
      expect(screen.queryByRole("tab", { name: gone })).toBeNull();
    }
  });

  it("a bare /match still opens the deck by default, preserving the default discovery view", () => {
    draw("/match");
    expect(screen.getByText("the deck")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Grid" })).toHaveAttribute("aria-selected", "false");
  });

  it("Grid shows the grid and writes the URL, without leaving the Browse tab", async () => {
    draw("/match");
    click("tab", "Grid");
    expect(await screen.findByText("the grid")).toBeInTheDocument();
    expect(screen.queryByText("the deck")).toBeNull();
    expect(screen.getByRole("tab", { name: "Grid" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("/match?tab=browse&view=grid");
  });

  it("the Connected tab opens on accepted connections", async () => {
    draw("/match");
    click("tab", "Connected");
    expect(await screen.findByText("accepted connections")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Connected" })).toHaveAttribute("aria-selected", "true");
  });

  it("moving between sections ends a search term that arrived with a link, and back to Browse resets it to the deck", async () => {
    draw("/match?tab=browse&view=grid&q=motion");
    expect(await screen.findByText("the grid")).toBeInTheDocument();
    click("tab", "Connected");
    expect(await screen.findByText("accepted connections")).toBeInTheDocument();
    expect(screen.getByTestId("location")).not.toHaveTextContent("q=");
    click("tab", "Browse");
    expect(await screen.findByText("the deck")).toBeInTheDocument();
  });
});

describe("Match: old links to the removed sections still land somewhere useful", () => {
  it("an old link to the Discover tab opens Browse on the deck", () => {
    draw("/match?tab=discover");
    expect(screen.getByText("the deck")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
  });

  it("an old link to the Directory opens the Grid, keeping the search term", async () => {
    draw("/match?tab=directory&q=designer");
    expect(await screen.findByText("the grid")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Grid" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("q=designer");
  });

  it("old links to Interested and Sent interests open Connected", async () => {
    for (const path of ["/match?tab=interested", "/match?tab=connected&view=interested", "/match?tab=connected&view=sent"]) {
      const { unmount } = draw(path);
      expect(await screen.findByText("accepted connections")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Connected" })).toHaveAttribute("aria-selected", "true");
      unmount();
    }
  });
});
