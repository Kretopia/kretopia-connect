import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { User } from "lucide-react";
import { SettingsShell } from "../SettingsShell";

const domains = [{ id: "account", label: "Account", icon: User }];

describe("SettingsShell", () => {
  it("shows the sidebar navigation on the full page", () => {
    render(
      <SettingsShell domains={domains} active="account" onSelect={vi.fn()}>
        <p>Card</p>
      </SettingsShell>,
    );
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument();
    expect(screen.getByText("Card")).toBeInTheDocument();
  });

  it("drops the sidebar in the drawer, so the content is never cut in two", () => {
    render(
      <SettingsShell domains={domains} active="account" onSelect={vi.fn()} embedded>
        <p>Card</p>
      </SettingsShell>,
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("Card")).toBeInTheDocument();
  });
});
