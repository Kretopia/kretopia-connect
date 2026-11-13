import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Heart, LayoutGrid } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentToggle } from "../SegmentToggle";

afterEach(cleanup);

const OPTIONS = [
  { value: "deck" as const, label: "Deck", icon: Heart },
  { value: "grid" as const, label: "Grid", icon: LayoutGrid },
];

describe("SegmentToggle: the two-view switch inside one tab", () => {
  it("names both segments and marks the active one", () => {
    render(<SegmentToggle value="deck" onChange={vi.fn()} options={OPTIONS} label="Browse view" />);
    expect(screen.getByRole("group", { name: "Browse view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deck" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "false");
  });

  // Same convention as GigsViewToggle: the active segment is the glass system's own `default` variant, never a
  // ghost button painted with bg-primary (that colour is the same as .btn-glass's forced text ink).
  it("styles the active segment through the glass default variant, idle through ghost", () => {
    render(<SegmentToggle value="deck" onChange={vi.fn()} options={OPTIONS} label="Browse view" />);
    const active = screen.getByRole("button", { name: "Deck" });
    const idle = screen.getByRole("button", { name: "Grid" });
    expect(active.className).toContain("btn-glass-primary");
    expect(idle.className).toContain("btn-glass-ghost");
  });

  it("switches from either side", () => {
    const onChange = vi.fn();
    render(<SegmentToggle value="grid" onChange={onChange} options={OPTIONS} label="Browse view" />);
    fireEvent.click(screen.getByRole("button", { name: "Deck" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("deck");
  });
});
