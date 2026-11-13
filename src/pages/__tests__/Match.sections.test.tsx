import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Browse (Discover's deck merged in) and Connected (Interested merged in) each hold two views behind one
// SegmentToggle instead of being two tabs apiece -- see src/lib/matchSections.ts.
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => null }));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({ StudioFeatureShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/swipe", () => ({ MatchDeck: () => <p>the deck</p> }));
vi.mock("@/components/swipe/MatchPulse", () => ({ MatchPulse: () => null }));
vi.mock("@/components/discover/BrowseCreators", () => ({ BrowseCreators: () => <p>the grid</p> }));
vi.mock("@/components/circle/ConnectedCollaborators", () => ({ ConnectedCollaborators: () => <p>accepted connections</p> }));
vi.mock("@/components/swipe/LikesYouGrid", () => ({ LikesYouGrid: () => <p>people interested in you</p> }));
vi.mock("@/pages/PassportDirectory", () => ({ default: () => <p>directory</p> }));
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

describe("Match: Browse and Connected each hold their old second tab as a view, not a tab of their own", () => {
  it("there is no top-level Discover or Interested tab any more", () => {
    draw("/match");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Browse", "Directory", "Connected"]);
    expect(screen.queryByRole("tab", { name: "Discover" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Interested" })).toBeNull();
  });

  it("a bare /match still opens the deck by default, same as before the merge", () => {
    draw("/match");
    expect(screen.getByText("the deck")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deck" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Browse's Grid segment shows the grid and writes the URL, without leaving the Browse tab", async () => {
    draw("/match");
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(await screen.findByText("the grid")).toBeInTheDocument();
    expect(screen.queryByText("the deck")).toBeNull();
    expect(screen.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("/match?tab=browse&view=grid");
  });

  it("the Connected tab opens on accepted connections, with its own segment toggle", async () => {
    draw("/match");
    click("tab", "Connected");
    expect(await screen.findByText("accepted connections")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connected" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Interested" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Connected's Interested segment shows who is interested, and writes the URL", async () => {
    draw("/match");
    click("tab", "Connected");
    await screen.findByText("accepted connections");
    fireEvent.click(screen.getByRole("button", { name: "Interested" }));
    expect(await screen.findByText("people interested in you")).toBeInTheDocument();
    expect(screen.queryByText("accepted connections")).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent("/match?tab=connected&view=interested");
  });

  it("switching to Directory and back to Browse resets Browse to its default (Deck), not a stale Grid", async () => {
    draw("/match?tab=browse&view=grid");
    expect(await screen.findByText("the grid")).toBeInTheDocument();
    click("tab", "Directory");
    expect(await screen.findByText("directory")).toBeInTheDocument();
    click("tab", "Browse");
    expect(await screen.findByText("the deck")).toBeInTheDocument();
  });

  it("an old link to the Discover tab opens Browse on the deck", () => {
    draw("/match?tab=discover");
    expect(screen.getByText("the deck")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
  });

  it("an old link to the Interested tab opens Connected on that same view", async () => {
    draw("/match?tab=interested");
    expect(await screen.findByText("people interested in you")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Connected" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Interested" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Directory keeps its own clean URL, with no leftover view param", async () => {
    draw("/match?tab=browse&view=grid");
    click("tab", "Directory");
    expect(await screen.findByText("directory")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/match?tab=directory");
    expect(screen.getByTestId("location")).not.toHaveTextContent("view=");
  });
});
