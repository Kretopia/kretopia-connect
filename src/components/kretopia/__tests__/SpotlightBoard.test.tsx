import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpotlightBoard } from "../SpotlightBoard";

const renderBoard = (value: "magazine" | "podcast" = "magazine", onValueChange = vi.fn()) =>
  render(
    <SpotlightBoard
      value={value}
      onValueChange={onValueChange}
      magazine={<div>magazine-panel</div>}
      podcast={<div>podcast-panel</div>}
    />,
  );

describe("SpotlightBoard", () => {
  it("shows two equal tabs with the active one marked selected", () => {
    renderBoard("podcast");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Magazine", "Podcast"]);
    expect(screen.getByRole("tab", { name: "Podcast" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Magazine" })).toHaveAttribute("aria-selected", "false");
  });

  it("renders only the active panel", () => {
    renderBoard("magazine");
    expect(screen.getByText("magazine-panel")).toBeInTheDocument();
    expect(screen.queryByText("podcast-panel")).toBeNull();
  });

  it("asks to switch when the other tab is pressed", () => {
    const onValueChange = vi.fn();
    renderBoard("magazine", onValueChange);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Podcast" }), { button: 0 });
    expect(onValueChange).toHaveBeenCalledWith("podcast");
  });

  it("no longer carries the removed intro copy", () => {
    const { container } = renderBoard("magazine");
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/The Spotlight desk/);
    expect(text).not.toMatch(/Read it or hear it/);
    expect(text).not.toMatch(/no sign-up needed/);
    expect(text).not.toMatch(/tap any story to open it/);
  });
});
