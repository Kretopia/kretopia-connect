import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Navbar from "@/components/Navbar";

const { autoHide } = vi.hoisted(() => ({ autoHide: { hiddenByScroll: true, idle: true, idleOpacity: 0.4, forceVisible: false } }));

vi.mock("@/hooks/useAutoHideNavbar", () => ({ useAutoHideNavbar: () => autoHide }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ subscriptionInfo: { subscribed: false, tier: null } }) }));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/hooks/useCrewUnread", () => ({ useCrewUnread: () => ({ badge: undefined }) }));
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => ({ isBusiness: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// Any read ends in an empty, successful result (the signed-in bar looks up the avatar).
vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_target, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : () => chain),
    apply: () => chain,
  });
  return { supabase: { from: () => chain, rpc: () => chain, channel: () => chain, removeChannel: () => undefined } };
});
vi.mock("@/components/search/UnifiedSearchDropdown", () => ({ UnifiedSearchDropdown: () => <input role="combobox" aria-label="Search a name, project or opportunity" /> }));
vi.mock("@/components/NotificationCenter", () => ({ NotificationCenter: () => null }));
vi.mock("@/components/messages/MessagesDrawer", () => ({ MessagesDrawer: () => null }));
vi.mock("@/components/SettingsDrawer", () => ({ SettingsDrawer: () => null }));
vi.mock("@/components/AccountSwitcher", () => ({ AccountSwitcher: () => null }));
vi.mock("@/components/storage/StorageMeter", () => ({ StorageMeter: () => null }));
vi.mock("@/components/company/CompanyModeBadge", () => ({ CompanyModeBadge: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">theme</button> }));

const renderBar = (path = "/landing", user: { id: string } | null = null) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar user={user as never} />
    </MemoryRouter>,
  );

describe("the signed-out top bar (the designer's KretopiaHero header)", () => {
  beforeEach(() => {
    autoHide.hiddenByScroll = true;
    autoHide.idle = true;
  });

  it("keeps the same rubrics, as words only: Credits, Spotlight, About Us, with no icon", () => {
    renderBar();
    const rubrics = document.querySelector(".k-site-nav") as HTMLElement;
    const links = within(rubrics).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Credits", "/credits"],
      ["Spotlight", "/spotlight"],
      ["About Us", "/about"],
    ]);
    expect(rubrics.querySelector("svg")).toBeNull();
  });

  it("marks the page you are on, which draws the gradient underline", () => {
    renderBar("/about");
    const rubrics = document.querySelector(".k-site-nav") as HTMLElement;
    expect(within(rubrics).getByRole("link", { name: "About Us" })).toHaveAttribute("aria-current", "page");
    expect(within(rubrics).getByRole("link", { name: "Credits" })).not.toHaveAttribute("aria-current");
  });

  it("wears the designer's Sign in and Join Kretopia buttons, without icons", () => {
    renderBar();
    const signIn = screen.getByRole("link", { name: "Sign in" });
    const join = screen.getByRole("link", { name: "Join Kretopia" });
    expect(signIn).toHaveAttribute("href", "/auth?tab=signin");
    expect(join).toHaveAttribute("href", "/auth?tab=signup");
    expect(signIn).toHaveClass("k-nav-signin");
    expect(join).toHaveClass("k-nav-join");
    expect(signIn.querySelector("svg")).toBeNull();
    expect(join.querySelector("svg")).toBeNull();
    // Sign in leaves the bar on a phone: it is in the menu there.
    expect(signIn).toHaveClass("hidden", "sm:inline-flex");
  });

  it("is the blurred translucent bar, and it never hides or dims on scroll", () => {
    renderBar();
    const bar = document.querySelector("[data-nav-chrome]") as HTMLElement;
    expect(bar).toHaveClass("k-guest-nav");
    expect(bar.style.transform).toBe("translateY(0)");
    expect(bar.style.opacity).toBe("1");
  });

  it("leaves the signed-in bar as it was: it still hides and dims", () => {
    renderBar("/", { id: "u1" });
    const bar = document.querySelector("[data-nav-chrome]") as HTMLElement;
    expect(bar).not.toHaveClass("k-guest-nav");
    expect(bar.style.transform).toBe("translateY(-100%)");
    expect(document.querySelector(".k-site-nav")).toBeNull();
    expect(screen.queryByRole("link", { name: "Join Kretopia" })).not.toBeInTheDocument();
  });

  it("keeps search and the theme toggle in the bar", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "theme" })).toBeInTheDocument();
  });

  it("centres the rubrics on the screen: the middle cell sits between two equal columns", () => {
    renderBar();
    const row = (document.querySelector(".k-site-nav") as HTMLElement).parentElement as HTMLElement;
    expect(row.className).toContain("lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
  });

  describe("the search", () => {
    const openSearch = () => {
      renderBar();
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      return screen.getByRole("dialog");
    };

    it("is the hero field in a quick floating panel: fades over 100 ms, no slide, no panel chrome, no corner button", () => {
      const dialog = openSearch();
      expect(dialog).toHaveClass("data-[state=open]:duration-100", "data-[state=open]:fade-in-0");
      expect(dialog.className).not.toMatch(/slide-in|duration-500|backdrop-blur|bg-background\b|shadow-lg|p-6/);
      expect(within(dialog).getByRole("combobox")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    });

    it("is as wide as the hero field (34rem plus 1 cm each side) and sits below the taller signed-out bar", () => {
      const dialog = openSearch();
      expect(dialog.className).toContain("w-[min(calc(34rem+2cm),calc(100vw-2rem))]");
      expect(dialog.className).toContain("top-[calc(5.25rem+env(safe-area-inset-top,0px))]");
    });

    it("dims the page lightly, without blurring it", () => {
      openSearch();
      const overlay = document.querySelector('[data-state="open"].fixed.inset-0') as HTMLElement;
      expect(overlay.className).toContain("bg-background/40");
      expect(overlay.className).not.toMatch(/backdrop-blur/);
    });

    it("is still named for screen readers", () => {
      const dialog = openSearch();
      expect(within(dialog).getByRole("heading", { name: "Search Kretopia" })).toHaveClass("sr-only");
    });
  });
});
