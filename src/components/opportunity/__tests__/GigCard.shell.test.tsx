import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Save and Quick Apply own their own state and dialogs and are tested where they live.
vi.mock("@/components/opportunity/BookmarkButton", () => ({ BookmarkButton: ({ opportunityId }: { opportunityId: string }) => <button type="button" aria-label={`Save ${opportunityId}`}>save</button> }));
vi.mock("@/components/opportunity/EasyApplyButton", () => ({ EasyApplyButton: ({ opportunityTitle }: { opportunityTitle: string }) => <button type="button">Quick Apply to {opportunityTitle}</button> }));

import GigCard, { closingLabel, type GigOpportunity } from "../GigCard";

const gig = (over: Partial<GigOpportunity> = {}): GigOpportunity => ({
  id: "g1", title: "Colourist for a documentary", description: "Ten days of grading.", type: "job", compensation: "$800", location: "Porto", skills: ["Resolve", "Look dev"],
  created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), created_by: "u9", status: "open", ...over,
});
const creator = { user_id: "u9", full_name: "Mira Soto", avatar_url: null, role: "Producer" };
const draw = (props: Partial<React.ComponentProps<typeof GigCard>> = {}) =>
  render(<MemoryRouter><GigCard opportunity={gig()} creator={creator} compact {...props} /></MemoryRouter>);

describe("GigCard: the shared-card variant for a grid of results", () => {
  it("draws the opportunity as the shared card, with the creator, the budget and both actions", () => {
    draw({ variant: "shell" });
    const card = screen.getByTestId("gig-rail-card-g1");
    expect(card).toHaveTextContent("Colourist for a documentary");
    expect(card).toHaveTextContent("Posted by Mira Soto");
    expect(card).toHaveTextContent("Budget: $800");
    expect(card.querySelector('[data-card-part="cover"]')!.className).toContain("aspect-[16/9]");
    expect(screen.getByRole("button", { name: "Save g1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quick Apply to Colourist for a documentary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Colourist for a documentary" })).toHaveAttribute("href", "/opportunity/g1");
  });

  it("carries the match score only when there is a real one", () => {
    const { unmount } = draw({ variant: "shell" });
    expect(screen.getByTestId("gig-rail-card-g1").textContent).not.toMatch(/%/);
    unmount();
    draw({ variant: "shell", matchScore: 74 });
    expect(screen.getByTestId("gig-rail-card-g1")).toHaveTextContent("74% match");
  });

  it("leaves the default card exactly as it was: its own poster/editorial layout, not the shared card", () => {
    draw();
    expect(screen.queryByTestId("gig-rail-card-g1")).toBeNull();
    expect(screen.getByRole("heading", { name: "Colourist for a documentary" }).tagName).toBe("H3");
    expect(screen.getByText("Budget")).toBeInTheDocument();
  });

  it("still exports closingLabel for what imported it from here", () => {
    expect(closingLabel(null)).toBeNull();
    expect(closingLabel("2099-03-04T00:00:00.000Z")).toBe("Closes Mar 4");
  });
});
