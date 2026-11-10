import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

let isBusiness = false;
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => ({ isBusiness }) }));

import KretopiaBottomNav from "../KretopiaBottomNav";

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><KretopiaBottomNav /></MemoryRouter>);

describe("mobile navigation", () => {
  it("Scout opens /scout, the same page as desktop Scout, and stays current on the opportunities pages", () => {
    isBusiness = false;
    const { unmount } = renderAt("/opportunities");
    const scout = screen.getByRole("link", { name: /^Scout/ });
    expect(scout).toHaveAttribute("href", "/scout");
    expect(scout).toHaveAttribute("aria-current", "page");
    unmount();
    renderAt("/scout");
    expect(screen.getByRole("link", { name: /^Scout/ })).toHaveAttribute("aria-current", "page");
  });

  it("matches the desktop nav's Scout destination", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const desktop = readFileSync(resolve(__dirname, "../../Navbar.tsx"), "utf8");
    expect(desktop).toMatch(/path: "\/scout", icon: Compass, label: "Scout"/);
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
    expect(kids.map((k) => k.textContent)).toEqual(["Home", "Match", "Passport", "Scout", "Studio"]);
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
    renderAt("/scout");
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
    renderAt("/scout");
    const active = screen.getAllByRole("link").filter((l) => l.getAttribute("data-active") === "true");
    expect(active).toHaveLength(1);
    expect(active[0]).toBe(screen.getByRole("link", { name: /^Scout/ }));
    expect(active[0].className).toContain("bg-foreground/10");
    expect(screen.getByRole("link", { name: /^Home/ })).not.toHaveAttribute("data-active");
    expect(screen.queryByTestId("nav-active-mark")).not.toBeInTheDocument();
  });
});
