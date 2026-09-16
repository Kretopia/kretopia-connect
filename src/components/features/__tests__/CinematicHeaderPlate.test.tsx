import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CinematicHeaderPlate } from "../CinematicHeaderPlate";

describe("CinematicHeaderPlate", () => {
  it("wraps a long subtitle at max-w-xl by default, unchanged from before subtitleOneLine existed", () => {
    render(
      <CinematicHeaderPlate
        eyebrow="Test"
        title="Some title"
        subtitle="A long supporting line that most callers expect to wrap across two or three lines on a narrow screen."
      />,
    );
    const subtitle = screen.getByText(/A long supporting line/);
    expect(subtitle).toHaveClass("max-w-xl");
    expect(subtitle).not.toHaveClass("whitespace-nowrap");
    expect(subtitle).not.toHaveAttribute("style");
  });

  it("keeps the subtitle on one line and drops the width cap when subtitleOneLine is set", () => {
    render(
      <CinematicHeaderPlate
        eyebrow="Test"
        title="Some title"
        subtitle="Short and punchy."
        subtitleOneLine
      />,
    );
    const subtitle = screen.getByText("Short and punchy.");
    expect(subtitle).toHaveClass("whitespace-nowrap");
    expect(subtitle).not.toHaveClass("max-w-xl");
  });
});
