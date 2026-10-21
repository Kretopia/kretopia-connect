import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GigsViewToggle } from "../GigsViewToggle";

afterEach(cleanup);

describe("Gigs feed switch", () => {
  it("names both segments and marks the active one", () => {
    render(<GigsViewToggle value="scouted" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Scouted for you" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Marketplace" })).toHaveAttribute("aria-pressed", "false");
  });

  // Regression: the active segment was a ghost glass button painted with `bg-primary`. `.btn-glass` forces its text to
  // the glass ink with !important and that ink equals `--primary`, so label and icon vanished into the background.
  it("styles the active segment through the glass variant, never by painting a primary background over it", () => {
    render(<GigsViewToggle value="scouted" onChange={vi.fn()} />);
    const active = screen.getByRole("button", { name: "Scouted for you" });
    const idle = screen.getByRole("button", { name: "Marketplace" });
    expect(active.className).toContain("btn-glass-primary");
    expect(idle.className).toContain("btn-glass-ghost");
    for (const button of [active, idle]) {
      expect(button.className).not.toMatch(/(^|\s)(bg-primary|bg-secondary|text-primary-foreground|text-secondary-foreground)(\s|$)/);
    }
  });

  it("switches view from either side", () => {
    const onChange = vi.fn();
    render(<GigsViewToggle value="marketplace" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Marketplace" }).className).toContain("btn-glass-primary");
    fireEvent.click(screen.getByRole("button", { name: "Scouted for you" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("scouted");
  });
});
