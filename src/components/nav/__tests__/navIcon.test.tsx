import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/pages/messages/useConversations", () => ({ useConversations: () => ({ unreadCounts: new Map() }) }));
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ notifications: [], unreadCount: 0, loading: false, markAsRead: vi.fn(), markAllAsRead: vi.fn(), deleteNotification: vi.fn(), vouchOnCredit: vi.fn() }),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: vi.fn() }) }));

import { MessagesDrawer } from "@/components/messages/MessagesDrawer";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";
import { NAV_ICON, NAV_ICON_BUTTON, NAV_ICON_STROKE, SEARCH_ICON, SUN_ICON } from "../navIcon";

/** What the top bar's icon buttons draw, each from its own component. */
const drawn = {
  messages: () => render(<MemoryRouter><MessagesDrawer /></MemoryRouter>).container,
  notifications: () => render(<MemoryRouter><NotificationCenter /></MemoryRouter>).container,
  theme: () => render(<ThemeToggle />).container,
};

// Ink measured in a browser (svg.getBBox on the glyph, in its own 24-unit box) and the fill that gives next to the message icon's 19.01.
const MESSAGE_INK = 19.01;
const FILL = MESSAGE_INK / 24;
const boxOf = (viewBox: string) => Number(viewBox.split(" ")[2]);

describe("the top bar's action icons share one size, one stroke and one box", () => {
  it("draw at the same CSS width and height", () => {
    expect(NAV_ICON).toBe("h-4 w-4");
    for (const container of [drawn.messages(), drawn.notifications(), drawn.theme()]) {
      const svg = container.querySelector("button svg") as SVGElement;
      expect(svg).toHaveClass("h-4", "w-4");
      expect(svg.getAttribute("class")).not.toMatch(/h-\[18px\]|sm:h-5|h-5 w-5/);
    }
  });

  it("sit in the same button box, 32 px on a phone and 40 px from sm, which is above the 24 px minimum for a touch target", () => {
    for (const container of [drawn.messages(), drawn.notifications(), drawn.theme()]) {
      const button = container.querySelector("button") as HTMLButtonElement;
      for (const cls of NAV_ICON_BUTTON.split(" ")) expect(button, cls).toHaveClass(cls);
      expect(button.className).not.toMatch(/\bh-9\b|\bw-9\b/);
    }
    expect(NAV_ICON_BUTTON).toContain("h-8 w-8 sm:h-10 sm:w-10");
  });

  it("draw lucide glyphs in the Kretopia glyph set's stroke, not lucide's 2", () => {
    expect(NAV_ICON_STROKE).toBe(1.75);
    for (const container of [drawn.messages(), drawn.notifications()]) {
      expect((container.querySelector("button svg") as SVGElement).getAttribute("stroke-width")).toBe(String(NAV_ICON_STROKE));
    }
  });

  it("keeps the theme toggle's own box when a caller sizes it (the menu sheet keeps its 40 px target)", () => {
    const { container } = render(<ThemeToggle className="h-10 w-10" />);
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).toHaveClass("h-10", "w-10");
    expect(button).not.toHaveClass("h-8");
  });

  it("gives the Kretopia search glyph and the sun the fill of the message icon beside them, and the same line weight on screen", () => {
    for (const [name, ink, crop] of [["search", 15.75, SEARCH_ICON], ["sun", 20, SUN_ICON]] as const) {
      const box = boxOf(crop.viewBox);
      expect(ink / box, `${name} fill`).toBeCloseTo(FILL, 2);
      // the stroke is scaled with the crop, so it is the same number of screen pixels as 1.75 in a 24-unit box
      expect(crop.strokeWidth / box, `${name} line weight`).toBeCloseTo(NAV_ICON_STROKE / 24, 3);
    }
  });

  it("draws the search glyph from the shared crop, at the shared size", () => {
    const { container } = render(<KretopiaIcon name="search" className={NAV_ICON} {...SEARCH_ICON} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.getAttribute("viewBox")).toBe(SEARCH_ICON.viewBox);
    expect(svg.getAttribute("stroke-width")).toBe(String(SEARCH_ICON.strokeWidth));
    expect(svg).toHaveClass("h-4", "w-4");
  });
});
