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

  it("keeps four public navigation links, as words only, with no icon", () => {
    renderBar();
    const rubrics = document.querySelector(".k-site-nav") as HTMLElement;
    const links = within(rubrics).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Platform", "/landing"],
      ["For Creatives", "/passport"],
      ["For Companies", "/post-opportunity"],
      ["Discover", "/discover"],
    ]);
    expect(rubrics.querySelector("svg")).toBeNull();
  });

  it("marks the page you are on, which draws the gradient underline", () => {
    renderBar("/landing");
    const rubrics = document.querySelector(".k-site-nav") as HTMLElement;
    expect(within(rubrics).getByRole("link", { name: "Platform" })).toHaveAttribute("aria-current", "page");
    expect(within(rubrics).getByRole("link", { name: "Discover" })).not.toHaveAttribute("aria-current");
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
    // Sign in stays in the bar on a phone: the designer's mobile header has no hamburger.
    expect(signIn).not.toHaveClass("hidden");
  });

  it("is the blurred translucent bar, and it never hides or dims on scroll", () => {
    renderBar();
    const bar = document.querySelector("[data-nav-chrome]") as HTMLElement;
    expect(bar).toHaveClass("k-top-bar");
    expect(bar.style.transform).toBe("translateY(0)");
    expect(bar.style.opacity).toBe("1");
  });

  it("keeps the signed-in bar's behaviour: it still hides on scroll and shows no sign-in buttons", () => {
    renderBar("/", { id: "u1" });
    const bar = document.querySelector("[data-nav-chrome]") as HTMLElement;
    expect(bar.style.transform).toBe("translateY(-100%)");
    expect(screen.queryByRole("link", { name: "Join Kretopia" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
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

  describe("on a phone and a tablet: the designer's two rows", () => {
    it("has no hamburger: the rubrics are a row of their own under the lockup", () => {
      renderBar();
      expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();
      const rubrics = document.querySelector(".k-site-nav") as HTMLElement;
      expect(rubrics).not.toHaveClass("hidden");
      expect(rubrics.className).toContain("row-start-2");
      expect(rubrics.className).toContain("lg:row-start-1");
      expect(rubrics.className).toContain("lg:col-start-2");
    });

    it("puts the lockup and Sign in / Join on row 1, and search and the theme at the end of row 2", () => {
      renderBar();
      const signIn = screen.getByRole("link", { name: "Sign in" }).parentElement as HTMLElement;
      expect(signIn.className).toContain("row-start-1");
      expect(signIn.className).toContain("col-span-2");
      const tools = screen.getByRole("button", { name: "Search" }).parentElement as HTMLElement;
      expect(tools.className).toContain("row-start-2");
      expect(tools.className).toContain("col-start-2");
      expect(tools).toContainElement(screen.getByRole("button", { name: "theme" }));
    });

    it("keeps the second column a fixed icon width, so the actions cannot squeeze the rubrics", () => {
      renderBar();
      const grid = (document.querySelector(".k-site-nav") as HTMLElement).parentElement as HTMLElement;
      expect(grid.className).toContain("grid-cols-[minmax(0,1fr)_4.5rem]");
      expect(grid.className).toContain("sm:grid-cols-[minmax(0,1fr)_5.5rem]");
    });

    it("opens the search in the middle of the screen, not under whichever bar is showing", () => {
      renderBar();
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).not.toMatch(/top-\[calc\(/);
      expect(dialog.style.top).not.toBe("");
    });
  });

  describe("the signed-in bar wears the same look", () => {
    it("has the same blurred bar and the same rubrics, as words only, centred like the visitor's", () => {
      renderBar("/desk", { id: "u1" });
      const bar = document.querySelector("[data-nav-chrome]") as HTMLElement;
      expect(bar).toHaveClass("k-top-bar");
      const rubrics = document.querySelector(".k-site-nav") as HTMLElement;
      expect(within(rubrics).getAllByRole("link").map((l) => l.textContent)).toEqual(["Today", "Match", "Studio", "Scout", "Passport"]);
      expect(within(rubrics).getByRole("link", { name: "Match" })).toHaveAttribute("href", "/match");
      // one entry for work: Scout is inside Opportunities, so the bar has no Scout of its own
      expect(within(rubrics).getByRole("link", { name: "Scout" })).toHaveAttribute("href", "/scout");
      expect(rubrics.querySelector("svg")).toBeNull();
      expect(within(rubrics).getByRole("link", { name: "Studio" })).toHaveAttribute("aria-current", "page");
      const row = rubrics.parentElement as HTMLElement;
      expect(row.className).toContain("lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    });

    it("keeps its account controls", () => {
      renderBar("/desk", { id: "u1" });
      expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    });
  });

  describe("the search", () => {
    const openSearch = () => {
      renderBar();
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      return screen.getByRole("dialog");
    };

    it("is the hero field in a quick floating panel: fades and settles in, no slide, no panel chrome, no corner button", () => {
      const dialog = openSearch();
      expect(dialog).toHaveClass("data-[state=open]:duration-150", "data-[state=open]:fade-in-0");
      expect(dialog.className).not.toMatch(/slide-in|duration-500|backdrop-blur|bg-background\b|shadow-lg|p-6/);
      expect(within(dialog).getByRole("combobox")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    });

    it("is as wide as the hero field (34rem plus 1 cm each side) and centred across the screen", () => {
      const dialog = openSearch();
      expect(dialog.className).toContain("w-[min(calc(34rem+2cm),calc(100vw-2rem))]");
      // Centred with auto margins: a translate would be knocked off centre by the open animation.
      expect(dialog.className).toContain("inset-x-0");
      expect(dialog.className).toContain("mx-auto");
      expect(dialog.className).not.toMatch(/-translate-x-1\/2/);
    });

    it("sits in the vertical middle of the visible screen and hands the results the room left under it", () => {
      const dialog = openSearch();
      // jsdom: 1024 x 768 and no visual viewport. A 64 px field centred on 768 starts at 352.
      expect(dialog.style.top).toBe("352px");
      expect(dialog.style.getPropertyValue("--k-search-room")).toBe("328px"); // 384 - 32 - 8 - 16
      expect(dialog).toHaveAttribute("data-search-stage", "center");
    });

    it("blurs and dims the page around it, strongly", () => {
      openSearch();
      const overlay = document.querySelector('[data-state="open"].fixed.inset-0') as HTMLElement;
      expect(overlay).toHaveClass("k-search-scrim");
    });

    it("is still named for screen readers", () => {
      const dialog = openSearch();
      expect(within(dialog).getByRole("heading", { name: "Search Kretopia" })).toHaveClass("sr-only");
    });
  });
});
