import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

let isBusiness = false;
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => ({ isBusiness }) }));

import KretopiaBottomNav from "../KretopiaBottomNav";
import { OPPORTUNITIES_PATH, SCOUT_PATH } from "@/lib/opportunityRoutes";

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><KretopiaBottomNav /></MemoryRouter>);

describe("mobile navigation", () => {
  it("has one entry for work: Opportunities (Scout is inside it), current on every page of that space", () => {
    isBusiness = false;
    // The bar says "Gigs" (the word has to fit a fifth of a phone); its accessible name is the full word.
    for (const path of ["/opportunities", SCOUT_PATH, "/scout", "/opportunity/abc", "/opportunity-dashboard"]) {
      const { unmount } = renderAt(path);
      const entry = screen.getByRole("link", { name: /^Opportunities/ });
      expect(entry, path).toHaveAttribute("href", "/opportunities");
      expect(entry, path).toHaveAttribute("aria-current", "page");
      expect(entry.textContent).toBe("Gigs");
      unmount();
    }
  });

  it("has no entry of its own for Scout, Perks or the Founding Circle: they are inside Opportunities and Creative Circle", () => {
    isBusiness = false;
    renderAt("/");
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/match", "/profile", "/opportunities", "/desk"]);
    for (const gone of ["/scout", "/perks", "/founding-member"]) expect(hrefs).not.toContain(gone);
  });

  it("matches the desktop nav's Opportunities entry", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const desktop = readFileSync(resolve(__dirname, "../../Navbar.tsx"), "utf8");
    expect(desktop).toMatch(/path: OPPORTUNITIES_PATH, icon: Compass, label: "Opportunities"/);
    expect(OPPORTUNITIES_PATH).toBe("/opportunities");
  });

  it("Company accounts keep Gigs at /opportunities", () => {
    isBusiness = true;
    renderAt("/desk");
    expect(screen.getByRole("link", { name: /^Gigs/ })).toHaveAttribute("href", "/opportunities");
  });

  it("shows five equal entries, Match right after Home (Today), and no + button or reserved slot", () => {
    isBusiness = false;
    renderAt("/");
    const kids = Array.from(screen.getByTestId("nav-grid").children);
    expect(kids).toHaveLength(5);
    expect(kids.every((k) => k.tagName === "A")).toBe(true);
    expect(kids.map((k) => k.textContent)).toEqual(["Home", "Match", "Passport", "Gigs", "Studio"]);
    expect(screen.getByTestId("nav-grid").className).toContain("grid-cols-5");
    expect(screen.queryByTestId("nav-fab-slot")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+|quick|create/i })).not.toBeInTheDocument();
  });

  it("Match opens the real /match page, and is the current entry there and only there", () => {
    isBusiness = false;
    const { unmount } = renderAt("/match");
    const match = screen.getByRole("link", { name: /^Match/ });
    expect(match).toHaveAttribute("href", "/match");
    expect(match).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page")).toHaveLength(1);
    unmount();
    renderAt(SCOUT_PATH);
    expect(screen.getByRole("link", { name: /^Match/ })).not.toHaveAttribute("aria-current");
  });

  it("matches the desktop nav: Match is right after Today there too", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const desktop = readFileSync(resolve(__dirname, "../../Navbar.tsx"), "utf8");
    expect(desktop).toMatch(/label: "Today" \},\s*(\/\/[^\n]*\n\s*)*\{ path: "\/match", icon: Heart, label: "Match" \}/);
  });

  it("Company accounts also get four entries", () => {
    isBusiness = true;
    renderAt("/desk");
    expect(Array.from(screen.getByTestId("nav-grid").children)).toHaveLength(4);
  });

  it("marks only the current entry, with a translucent pill and no gradient", () => {
    isBusiness = false;
    renderAt(SCOUT_PATH);
    const active = screen.getAllByRole("link").filter((l) => l.getAttribute("data-active") === "true");
    expect(active).toHaveLength(1);
    expect(active[0]).toBe(screen.getByRole("link", { name: /^Opportunities/ }));
    expect(active[0].className).toContain("bg-foreground/10");
    expect(screen.getByRole("link", { name: /^Home/ })).not.toHaveAttribute("data-active");
    expect(screen.queryByTestId("nav-active-mark")).not.toBeInTheDocument();
  });
});
