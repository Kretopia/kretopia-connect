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
});
