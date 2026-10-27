import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Palette, User } from "lucide-react";

import { SettingsNav } from "../SettingsNav";
import { SettingsShell } from "../SettingsShell";

const domains = [
  { id: "account", label: "Account", icon: User },
  { id: "preferences", label: "Preferences", icon: Palette },
];

describe("SettingsNav", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("is a hairline pill group: the active section is lifted with a ring, the others are muted", () => {
    render(<SettingsNav domains={domains} active="account" onSelect={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    expect(nav.className).toMatch(/rounded-2xl/);
    expect(nav.className).toMatch(/border-border/);
    const active = screen.getByRole("button", { name: "Account" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toMatch(/ring-1/);
    expect(active.className).toMatch(/bg-background/);
    expect(screen.getByRole("button", { name: "Preferences" })).not.toHaveAttribute("aria-current");
  });

  it("is one row that scrolls sideways on a phone, a sticky column from md", () => {
    render(<SettingsNav domains={domains} active="account" onSelect={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    expect(nav.className).toContain("flex-nowrap");
    expect(nav.className).toContain("overflow-x-auto");
    expect(nav.className).toContain("md:sticky");
    expect(nav.className).toContain("md:flex-col");
    expect(nav.className).toContain("md:overflow-visible");
  });

  it("keeps targets at least 44 px tall on a phone", () => {
    render(<SettingsNav domains={domains} active="account" onSelect={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("min-h-11");
  });

  it("selects a section on click, and keeps the one in use in view", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<SettingsNav domains={domains} active="account" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Preferences" }));
    expect(onSelect).toHaveBeenCalledWith("preferences");
    rerender(<SettingsNav domains={domains} active="preferences" onSelect={onSelect} />);
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest", inline: "center" });
  });
});

describe("SettingsShell cards", () => {
  it("puts every card on one inset hairline surface, on the page and in the drawer", () => {
    for (const embedded of [false, true]) {
      const { container, unmount } = render(
        <SettingsShell domains={domains} active="account" onSelect={vi.fn()} embedded={embedded}>
          <section>Card</section>
        </SettingsShell>,
      );
      const column = screen.getByText("Card").parentElement as HTMLElement;
      expect(column.className).toContain("[&>*]:rounded-2xl");
      expect(column.className).toContain("[&>*]:bg-background/40");
      expect(column.className).toContain("[&_h3]:text-lg");
      expect(column.className).toContain("max-sm:[&_.p-6]:px-4");
      expect(container).toBeTruthy();
      unmount();
    }
  });
});
