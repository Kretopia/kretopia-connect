import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Save and Quick Apply own their own state and dialogs and are tested where they live; here they are stand-ins that show what the card hands them.
vi.mock("@/components/opportunity/BookmarkButton", () => ({
  BookmarkButton: ({ opportunityId, className }: { opportunityId: string; className?: string }) => <button type="button" aria-label={`Save ${opportunityId}`} className={className}>save</button>,
}));
vi.mock("@/components/opportunity/EasyApplyButton", () => ({
  EasyApplyButton: ({ opportunityId, opportunityTitle, className, style }: { opportunityId: string; opportunityTitle: string; className?: string; style?: React.CSSProperties }) => (
    <button type="button" aria-label={`Quick Apply to ${opportunityTitle}`} data-opportunity={opportunityId} className={className} data-has-style={style ? "yes" : "no"}>Quick Apply</button>
  ),
}));

import { GigRailCard } from "../GigRailCard";
import type { GigOpportunity } from "../GigCard";

const gig = (over: Partial<GigOpportunity> = {}): GigOpportunity => ({
  id: "g1", title: "Lead actor for a short film", description: "Not shown on the rail.", type: "casting", compensation: "€400 / day",
  location: "Lisbon", skills: null, created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(), created_by: "u9", status: "open", ...over,
});

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const draw = (props: Partial<React.ComponentProps<typeof GigRailCard>> = {}, opportunity = gig()) =>
  render(
    <MemoryRouter initialEntries={["/studio"]}>
      <Routes>
        <Route path="/studio" element={<GigRailCard opportunity={opportunity} {...props} />} />
        <Route path="/opportunity/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
const card = () => screen.getByTestId("gig-rail-card-g1");

describe("GigRailCard: an opportunity on a rail is the shared card", () => {
  it("says what kind it is on the cover, and names the opportunity, where and when", () => {
    draw();
    const cover = card().querySelector('[data-card-part="cover"]') as HTMLElement;
    expect(within(cover).getByText("Casting Call")).toBeInTheDocument();
    expect(within(card()).getByText("Lead actor for a short film")).toBeInTheDocument();
    expect(card().querySelector('[data-card-part="meta"]')).toHaveTextContent("Lisbon · 3 days ago");
  });

  it("says the budget, and the usage terms when there are any, without inventing either", () => {
    draw({}, gig({ usage_type: "Broadcast", usage_territory: "EU", usage_duration: "2 years", usage_exclusive: true }));
    const tags = card().querySelector('[data-card-part="tags"]') as HTMLElement;
    expect(tags).toHaveTextContent("Budget: €400 / day");
    expect(tags).toHaveTextContent("Broadcast · EU · 2 years");
  });

  it("says Exchange: Trade for a barter, and a dash rather than a made-up budget when there is none", () => {
    const { unmount } = draw({}, gig({ type: "barter", compensation: null }));
    expect(card().querySelector('[data-card-part="tags"]')).toHaveTextContent("Exchange: Trade");
    unmount();
    draw({}, gig({ type: "collab", compensation: null }));
    expect(card().querySelector('[data-card-part="tags"]')).toHaveTextContent("Budget: —");
    expect(card().querySelector('[data-card-part="tags"]')).not.toHaveTextContent(/usage|Broadcast/i);
  });

  it("shows Scouted only for a scouted opportunity, and a match only when there is a real score", () => {
    const { unmount } = draw();
    expect(screen.queryByText("Scouted")).toBeNull();
    expect(card().textContent).not.toMatch(/%/);
    unmount();
    draw({ matchScore: 87 }, gig({ scouted_by: "kretopia" }));
    expect(screen.getByText("Scouted")).toBeInTheDocument();
    expect(card()).toHaveTextContent("87% match");
  });

  it("does not show the description: the rail is a glance, the page has the rest", () => {
    draw();
    expect(screen.queryByText("Not shown on the rail.")).toBeNull();
  });

  it("draws the opportunity's picture, and the kind's own colour and icon when there is none or it fails to load", () => {
    const { container, unmount } = draw({}, gig({ image_url: "https://x.test/call.jpg" }));
    const img = container.querySelector('img[src="https://x.test/call.jpg"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(card().querySelector('[data-card-part="cover"] .bg-gradient-to-br')).not.toBeNull();
    unmount();
    draw();
    expect(card().querySelector('[data-card-part="cover"] .bg-gradient-to-br')).not.toBeNull();
  });
});

describe("GigRailCard: what it does", () => {
  it("opens the opportunity from the card, as a real link", () => {
    draw();
    const link = screen.getByRole("link", { name: "Lead actor for a short film" });
    expect(link).toHaveAttribute("href", "/opportunity/g1");
    fireEvent.click(link);
    expect(screen.getByTestId("where")).toHaveTextContent("/opportunity/g1");
  });

  it("keeps Save on the cover and Quick Apply as the primary action, each above the card's link and each for this opportunity", () => {
    draw();
    const save = screen.getByRole("button", { name: "Save g1" });
    expect(save.closest('[data-card-part="cover"]')).not.toBeNull();
    expect(save.parentElement!.className).toContain("z-[3]");
    const apply = screen.getByRole("button", { name: "Quick Apply to Lead actor for a short film" });
    expect(apply).toHaveAttribute("data-opportunity", "g1");
    expect(apply.parentElement).toHaveAttribute("data-card-part", "primary");
    expect(apply.parentElement!.className).toContain("z-[3]");
    // the shared look: the card's save icon button, and its primary button with the brand-gradient border
    expect(save.className).toContain("rounded-[10px]");
    expect(apply.className).toContain("rounded-[9px]");
    expect(apply.className).toContain("border-transparent");
    expect(apply).toHaveAttribute("data-has-style", "yes");
  });

  it("saving and applying are not the same as opening: neither leaves the page", () => {
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Save g1" }));
    fireEvent.click(screen.getByRole("button", { name: "Quick Apply to Lead actor for a short film" }));
    expect(screen.queryByTestId("where")).toBeNull();
  });
});
