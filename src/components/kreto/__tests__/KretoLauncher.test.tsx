import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KretoLauncher } from "../KretoLauncher";

describe("KretoLauncher", () => {
  it("stays desktop-only unless the caller says the phone shows it", () => {
    render(<KretoLauncher />);
    const button = screen.getByRole("button", { name: "Open Kreto" });
    expect(button.className).toContain("hidden");
    expect(button.className).toContain("lg:flex");
    expect(button.className).not.toMatch(/(^|\s)flex(\s|$)/);
  });

  it("shows the same mascot on a phone, above the bottom nav, when asked to", () => {
    render(<KretoLauncher showOnMobile />);
    const button = screen.getByRole("button", { name: "Open Kreto" });
    expect(button.className).toMatch(/(^|\s)flex(\s|$)/);
    expect(button.className).not.toContain("hidden");
    // Clears the bottom nav and the safe area on a phone; the desktop corner is unchanged.
    expect(button.className).toContain("bottom-[calc(env(safe-area-inset-bottom)_+_4.75rem)]");
    expect(button.className).toContain("lg:bottom-[max(1.25rem,env(safe-area-inset-bottom))]");
    expect(button.querySelector("img")).toBeInTheDocument();
  });

  it("opens Kreto through the same event as before", () => {
    const seen = vi.fn();
    window.addEventListener("thrive-copilot:open", seen);
    render(<KretoLauncher showOnMobile />);
    fireEvent.click(screen.getByRole("button", { name: "Open Kreto" }));
    window.removeEventListener("thrive-copilot:open", seen);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
