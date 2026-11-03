import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

let isBusiness = false;
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => ({ isBusiness }) }));

import KretopiaBottomNav from "../KretopiaBottomNav";
import { BRAND_EDGE, BRAND_GRADIENT, FAB_CLEARANCE_PX, FAB_SIZE_PX, FAB_SLOT_PX } from "../bottomNavMetrics";

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

  it("reserves the middle for the + button: two entries, the slot, two entries, so no label is under it", () => {
    isBusiness = false;
    renderAt("/");
    const grid = screen.getByTestId("nav-grid");
    const kids = Array.from(grid.children);
    expect(kids).toHaveLength(5);
    expect(kids[2]).toBe(screen.getByTestId("nav-fab-slot"));
    expect(kids.filter((k) => k.tagName === "A")).toHaveLength(4);
    expect(kids.slice(0, 2).every((k) => k.tagName === "A")).toBe(true);
    expect(kids.slice(3).every((k) => k.tagName === "A")).toBe(true);
    expect(grid.style.gridTemplateColumns).toContain(`${FAB_SLOT_PX}px`);
  });

  it("the slot is the button plus real clear space on both sides", () => {
    expect(FAB_SLOT_PX).toBe(FAB_SIZE_PX + 2 * FAB_CLEARANCE_PX);
    expect(FAB_CLEARANCE_PX).toBeGreaterThanOrEqual(16);
  });

  it("Company accounts get the same slot between their two and two", () => {
    isBusiness = true;
    renderAt("/desk");
    const kids = Array.from(screen.getByTestId("nav-grid").children);
    expect(kids[2]).toBe(screen.getByTestId("nav-fab-slot"));
    expect(kids.filter((k) => k.tagName === "A")).toHaveLength(4);
  });

  it("marks only the current entry", () => {
    isBusiness = false;
    renderAt("/scout");
    expect(screen.getAllByTestId("nav-active-mark")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^Scout/ }).contains(screen.getByTestId("nav-active-mark"))).toBe(true);
    expect(screen.getByRole("link", { name: /^Home/ })).not.toHaveAttribute("data-active");
  });

  it("the mark, the edge line and the + ring all draw from Kretopia's four brand tokens", () => {
    for (const gradient of [BRAND_GRADIENT, BRAND_EDGE]) {
      for (const token of ["--k-g-1", "--k-g-2", "--k-g-3", "--k-g-4"]) expect(gradient).toContain(token);
    }
  });
});
