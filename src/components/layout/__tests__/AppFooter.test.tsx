import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { AppFooter } from "../AppFooter";
import { SharedFooterProvider } from "../sharedFooter";

afterEach(cleanup);

const inRouter = (node: React.ReactNode) => <MemoryRouter>{node}</MemoryRouter>;

describe("AppFooter: the Landing page's own footer, in the app's layout", () => {
  it("is the Landing footer: the same four link groups, with the legal links, and one footer element", () => {
    const { container } = render(inRouter(<AppFooter variant="balanced" />));
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    expect(screen.getAllByRole("navigation").map((nav) => nav.getAttribute("aria-label"))).toEqual(["Product", "Explore", "For", "Legal"]);
    const legal = within(screen.getByRole("navigation", { name: "Legal" }));
    for (const [name, href] of [["Terms of Service", "/terms"], ["Privacy Policy", "/privacy"], ["Community", "/community-guidelines"]]) {
      expect(legal.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("follows Daylight and Midnight like the Landing page does, by wearing its theme wrapper", () => {
    const { container } = render(inRouter(<AppFooter variant="default" />));
    expect(container.querySelector("[data-app-footer]")).toHaveClass("landing-theme");
  });

  it("keeps room at its foot below lg when the page has something fixed to the bottom of the screen", () => {
    const { container } = render(inRouter(<AppFooter variant="balanced" reserve="pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0" />));
    const wrapper = container.querySelector("[data-app-footer]") as HTMLElement;
    expect(wrapper.className).toContain("pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]");
    expect(wrapper.className).toContain("lg:pb-0");
  });

  it("carries the variant it is given: the default layout and the evened-out one differ in their columns", () => {
    const columns = (variant: "default" | "balanced") => {
      const { unmount } = render(inRouter(<AppFooter variant={variant} />));
      const counts = screen.getAllByRole("navigation").map((nav) => within(nav).getAllByRole("link").length);
      unmount();
      return counts;
    };
    expect(columns("default")).toEqual([5, 3, 4, 5]);
    expect(columns("balanced")).toEqual([4, 4, 4, 5]);
  });
});

describe("a page ends in one footer, not two", () => {
  const panel = () => (
    <WrappedShell titleId="t" eyebrow="Kretopia · Studio" title="Studio">
      <p>content</p>
    </WrappedShell>
  );

  it("a Wrapped panel keeps its own small brand footer when the app draws no footer under the page", () => {
    const { container } = render(inRouter(panel()));
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    expect(container.querySelector("footer")).toHaveTextContent("Studio");
  });

  it("…and gives way to the shared footer when there is one: a feature page then has exactly one footer", () => {
    const { container } = render(
      inRouter(
        <SharedFooterProvider value>
          <main>{panel()}</main>
          <AppFooter variant="balanced" />
        </SharedFooterProvider>,
      ),
    );
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    expect(container.querySelector("footer")).toBe(container.querySelector("[data-app-footer] footer"));
    expect(screen.getByRole("navigation", { name: "Legal" })).toBeInTheDocument();
  });

  it("a panel that opted out of its brand footer still has none, with or without the shared footer", () => {
    const { container } = render(
      inRouter(
        <WrappedShell titleId="t" eyebrow="Kretopia · Scout" title="Scout" brandFooter={false}>
          <p>content</p>
        </WrappedShell>,
      ),
    );
    expect(container.querySelectorAll("footer")).toHaveLength(0);
  });
});

describe("App.tsx draws the footer once, from the route policy", () => {
  const app = readFileSync(resolve(__dirname, "../../../App.tsx"), "utf8");

  it("renders AppFooter from appFooter(), and no page or layout pastes the Landing footer in", () => {
    expect(app).toMatch(/appFooter\(location\.pathname, !!user\)/);
    expect((app.match(/<AppFooter\b/g) ?? []).length).toBe(1);
    expect(app).not.toMatch(/<EditorialFooter\b/);
  });

  it("keeps the room under the bottom nav in the footer, not as an empty band above it", () => {
    expect(app).toMatch(/shouldAddBottomPadding = showBottomNav && !location\.pathname\.startsWith\('\/desk'\) && !footer/);
    expect(app).toMatch(/footerBottomReserve\(location\.pathname, showBottomNav\)/);
  });
});
