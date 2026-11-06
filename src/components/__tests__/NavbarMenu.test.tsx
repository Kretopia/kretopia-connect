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
