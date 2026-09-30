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

  it("renders the complete accent phrase as one gradient span without clipping the heading", () => {
    render(<CinematicHeaderPlate eyebrow="Collaborators" title="Match." accentTitle="Find your people." />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Match. Find your people.");
    expect(heading).toHaveClass("break-words");
    const accent = heading.querySelector(".k-gradient-text");
    expect(accent).toHaveTextContent("Find your people.");
    expect(accent?.children).toHaveLength(0);
  });
});
