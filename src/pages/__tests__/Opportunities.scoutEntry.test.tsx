import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

const draw = (entry = "/opportunities") => render(<MemoryRouter initialEntries={[entry]}><Opportunities /></MemoryRouter>);

beforeEach(() => { tone.isBusiness = false; });

describe("Opportunities: the way into Scout", () => {
  it("offers Scout next to the feed switch, and it opens Scout inside Opportunities", () => {
    draw();
    expect(screen.getByRole("link", { name: /Scout/ })).toHaveAttribute("href", SCOUT_PATH);
    expect(screen.getByRole("group", { name: "Gigs feed" })).toBeInTheDocument();
    expect(screen.getByText("Scouted for you", { selector: "p" })).toBeInTheDocument();
  });

  it("is there for a visitor too (the page is public), and the marketplace view keeps it", () => {
    draw("/opportunities?view=marketplace");
    expect(screen.getByRole("link", { name: /Scout/ })).toHaveAttribute("href", SCOUT_PATH);
    expect(screen.getByText("Marketplace feed")).toBeInTheDocument();
  });

  it("a company still gets its own view of the same address, unchanged", () => {
    tone.isBusiness = true;
    draw();
    expect(screen.getByText("Manage your roles")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Scout/ })).not.toBeInTheDocument();
  });
});
