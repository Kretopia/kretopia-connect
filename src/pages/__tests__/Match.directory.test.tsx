import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => null }));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({ StudioFeatureShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/swipe", () => ({ MatchDeck: () => <p>Discover people</p> }));
vi.mock("@/components/swipe/MatchPulse", () => ({ MatchPulse: () => null }));
vi.mock("@/pages/PassportDirectory", () => ({ default: ({ embedded }: { embedded: boolean }) => <p>{embedded ? "Integrated directory" : "Separate directory"}</p> }));
import Match from "../Match";

const Where = () => { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; };
const draw = (path: string) => render(<MemoryRouter initialEntries={[path]}><Match /><Where /></MemoryRouter>);

describe("Match owns Passport discovery", () => {
  it("opens the embedded directory from a compatible deep link", async () => {
    draw("/match?tab=directory&q=designer");
    expect(await screen.findByText("Integrated directory")).toBeInTheDocument();
    expect(screen.queryByText("Discover people")).not.toBeInTheDocument();
  });
  it("switches between discovery and directory without leaving Match or dropping search", async () => {
    draw("/match?q=designer");
    fireEvent.click(screen.getByRole("tab", { name: "Directory" }));
    expect(await screen.findByText("Integrated directory")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/match?q=designer&tab=directory");
    fireEvent.click(screen.getByRole("tab", { name: "Discover" }));
    expect(screen.getByText("Discover people")).toBeInTheDocument();
  });
});