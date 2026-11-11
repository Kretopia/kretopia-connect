import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Opportunities is the one space for work; Scout, its personalised search and shortlist, is one click from its header. */
const tone = vi.hoisted(() => ({ isBusiness: false }));
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => tone }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/pages/ManageOpportunities", () => ({ default: () => <p>Manage your roles</p> }));
vi.mock("@/components/circle/OpportunitiesFeed", () => ({ OpportunitiesFeed: () => <p>Marketplace feed</p> }));
vi.mock("@/components/opportunity/ScoutedGigsSection", () => ({ ScoutedGigsSection: () => <p>Scouted for you</p> }));
vi.mock("@/components/kretopia/EditorialPageHero", () => ({ EditorialPageHero: ({ children }: { children?: ReactNode }) => <div>{children}</div> }));

import Opportunities from "../Opportunities";
import { SCOUT_PATH } from "@/lib/opportunityRoutes";

const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="destination">{pathname + search}</output>;
};
const draw = (entry = "/opportunities") => render(<MemoryRouter initialEntries={[entry]}><Routes>
  <Route path="/opportunities" element={<Opportunities />} />
  <Route path="*" element={<Where />} />
</Routes></MemoryRouter>);
beforeEach(() => { tone.isBusiness = false; });
describe("Opportunities merges into Scout", () => {
  it("opens the personalised feed in Scout", () => {
    draw();
    expect(screen.getByTestId("destination")).toHaveTextContent("/scout?tab=scouted");
  });
  it("preserves the public marketplace view inside Scout", () => {
    draw("/opportunities?view=marketplace&q=film");
    expect(screen.getByTestId("destination")).toHaveTextContent("/scout?q=film&tab=marketplace");
  });
  it("preserves Company offer management", () => {
    tone.isBusiness = true;
    draw();
    expect(screen.getByText("Manage your roles")).toBeInTheDocument();
    expect(screen.queryByTestId("destination")).not.toBeInTheDocument();
  });
});
