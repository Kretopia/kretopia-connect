import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Navbar from "@/components/Navbar";

const { tone } = vi.hoisted(() => ({ tone: { isBusiness: false } }));

vi.mock("@/hooks/useAutoHideNavbar", () => ({ useAutoHideNavbar: () => ({ hiddenByScroll: false, idle: false, idleOpacity: 1, forceVisible: true }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ subscriptionInfo: { subscribed: false, tier: null } }) }));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/hooks/useCrewUnread", () => ({ useCrewUnread: () => ({ badge: undefined }) }));
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => ({ isBusiness: tone.isBusiness }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_target, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : () => chain),
    apply: () => chain,
  });
  return { supabase: { from: () => chain, rpc: () => chain, channel: () => chain, removeChannel: () => undefined } };
});
vi.mock("@/components/search/UnifiedSearchDropdown", () => ({ UnifiedSearchDropdown: () => null }));
vi.mock("@/components/NotificationCenter", () => ({ NotificationCenter: () => null }));
vi.mock("@/components/messages/MessagesDrawer", () => ({ MessagesDrawer: () => null }));
vi.mock("@/components/AccountSwitcher", () => ({ AccountSwitcher: () => null }));
vi.mock("@/components/storage/StorageMeter", () => ({ StorageMeter: () => null }));
vi.mock("@/components/company/CompanyModeBadge", () => ({ CompanyModeBadge: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">theme</button> }));

const openMenu = () => {
  render(
    <MemoryRouter initialEntries={["/desk"]}>
      <Navbar user={{ id: "u1" } as never} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return screen.getByRole("dialog");
};

describe("the signed-in hamburger menu", () => {
  beforeEach(() => {
    tone.isBusiness = false;
  });

  it("Personal: Settings, the theme switch and Sign Out are in the menu, since the top bar no longer carries them", () => {
    const menu = openMenu();
    expect(within(menu).getByRole("button", { name: /Settings/ })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "theme" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: /Sign Out/ })).toBeInTheDocument();
  });

  it("Company: keeps Settings, the theme switch and Sign Out, and does not repeat what the nav and top bar already show", () => {
    tone.isBusiness = true;
    const menu = openMenu();
    expect(within(menu).getByRole("button", { name: /Settings/ })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "theme" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: /Sign Out/ })).toBeInTheDocument();
    for (const repeated of ["Messages", "Studios", "Gigs", "Talent", "KrePay"]) {
      expect(within(menu).queryByRole("button", { name: new RegExp(`^${repeated}$`) })).not.toBeInTheDocument();
    }
    // Modules that are only reachable here stay.
    expect(within(menu).getByRole("button", { name: /Post a Gig/ })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: /Clients/ })).toBeInTheDocument();
  });
});

describe("Match sits right after Today", () => {
  beforeEach(() => {
    tone.isBusiness = false;
  });

  it("Personal: it is in the primary nav, right after Today, and so is not repeated in the menu", () => {
    const menu = openMenu();
    // the open menu is modal, so the bar behind it is aria-hidden: look at it as the page has it
    const rubrics = document.querySelector(".k-site-nav") as HTMLElement;
    expect(within(rubrics).getAllByRole("link", { hidden: true }).map((l) => l.textContent)).toEqual(["Today", "Match", "Studio", "Scout", "Passport"]);
    expect(within(rubrics).getByRole("link", { name: "Match", hidden: true })).toHaveAttribute("href", "/match");
    expect(within(rubrics).getByRole("link", { name: "Scout", hidden: true })).toHaveAttribute("href", "/scout");
    expect(within(menu).queryByRole("button", { name: "Match" })).not.toBeInTheDocument();
    // what was reachable from the menu still is
    for (const kept of ["Stages", "Kreto", "Events", "Creative Circle"]) expect(within(menu).getByRole("button", { name: kept })).toBeInTheDocument();
    // one entry per role: Scout is inside Opportunities, Perks and the Founding Circle are inside Creative Circle
    for (const gone of ["Scout", "Perks", "Founding Circle"]) expect(within(menu).queryByRole("button", { name: gone })).not.toBeInTheDocument();
  });

  it("Company: the menu lists Match immediately after Today, as before at the same route", () => {
    tone.isBusiness = true;
    const menu = openMenu();
    const tiles = [...menu.querySelectorAll(".k-menu-tile")].map((tile) => tile.getAttribute("aria-label"));
    expect(tiles.indexOf("Today")).toBeGreaterThanOrEqual(0);
    expect(tiles.indexOf("Match")).toBe(tiles.indexOf("Today") + 1);
    for (const gone of ["Scout", "Perks", "Founding Circle"]) expect(tiles).not.toContain(gone);
    expect(tiles).toContain("Creative Circle");
    fireEvent.click(within(menu).getByRole("button", { name: "Match" }));
    // the company's own nav is unchanged: it has no Today to put Match after
    const rubrics = document.querySelector(".k-site-nav") as HTMLElement;
    expect(within(rubrics).getAllByRole("link", { hidden: true }).map((l) => l.textContent)).toEqual(["Studios", "Gigs", "Talent", "KrePay"]);
  });
});

describe("the hamburger is the menu's own button, not a second controller", () => {
  const draw = () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/desk"]}>
        <Navbar user={{ id: "u1" } as never} />
      </MemoryRouter>,
    );
    const burger = () => container.querySelector(".k-burger") as SVGElement;
    const button = () => burger().closest("button") as HTMLButtonElement;
    return { burger, button };
  };

  it("is three equal bars at rest, on the one Open menu button", () => {
    const { burger, button } = draw();
    expect(button()).toHaveAttribute("aria-label", "Open menu");
    expect(screen.getAllByRole("button", { name: "Open menu" })).toHaveLength(1);
    const bars = [...burger().querySelectorAll("line")];
    expect(bars).toHaveLength(3);
    expect(new Set(bars.map((bar) => `${bar.getAttribute("x1")}-${bar.getAttribute("x2")}`)).size).toBe(1);
    expect(burger()).not.toHaveAttribute("data-open");
    expect(button()).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the X whenever the menu is open, with aria-expanded and aria-controls from the menu itself, for touch and keyboard alike", () => {
    const { burger, button } = draw();
    // opened from the keyboard: Enter on the focused button, not a mouse click
    button().focus();
    fireEvent.keyDown(button(), { key: "Enter" });
    fireEvent.click(button());
    expect(button()).toHaveAttribute("aria-expanded", "true");
    expect(burger()).toHaveAttribute("data-open", "true");
    const controls = button().getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).toBe(screen.getByRole("dialog"));
  });

  it("goes back to three bars when Escape closes the menu", () => {
    const { burger, button } = draw();
    fireEvent.click(button());
    expect(burger()).toHaveAttribute("data-open", "true");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button()).toHaveAttribute("aria-expanded", "false");
    expect(burger()).not.toHaveAttribute("data-open");
  });
});
