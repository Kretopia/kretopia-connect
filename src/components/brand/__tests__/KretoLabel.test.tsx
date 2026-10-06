import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { KretoLabel } from "../KretoLabel";

describe("KretoLabel", () => {
  it("shows the mini robot and the context, not the word Kreto, to sighted users", () => {
    const { container } = render(<KretoLabel context="Circle" />);
    // one robot
    expect(container.querySelectorAll('svg[viewBox="0 0 100 100"]')).toHaveLength(1);
    // the visible (non-sr-only, non-hidden) text is just the context
    const visible = Array.from(container.querySelectorAll("span[aria-hidden='true']")).map((n) => n.textContent);
    expect(visible).toContain("Circle");
    expect(visible.join(" ")).not.toMatch(/kreto/i);
  });

  it("still announces the full 'Kreto · Circle' to screen readers", () => {
    render(<KretoLabel context="Circle" />);
    const sr = screen.getByText(/Kreto · Circle/);
    expect(sr).toHaveClass("sr-only");
  });

  it("keeps the robot decorative: no button, no accessible name of its own", () => {
    const { container } = render(<KretoLabel context="Waiting on you" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"] svg, svg[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("is marked so tests and styles can tell a label robot from card artwork", () => {
    const { container } = render(<KretoLabel context="Scout" />);
    expect(container.querySelector("[data-kreto-label]")).toBeInTheDocument();
  });

  it("never claims activity: no state announcement is rendered", () => {
    render(<KretoLabel context="Scout" />);
    expect(screen.queryByText(/is working|is listening|needs you|unavailable/i)).not.toBeInTheDocument();
  });
});
