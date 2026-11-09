import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { EventAboutSection } from "../EventAboutSection";

describe("EventAboutSection", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 120 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 48 });
  });

  it("clamps to two mobile lines and three desktop lines, then expands in place", () => {
    render(<EventAboutSection description="An event description long enough to overflow the preview." />);

    const paragraph = screen.getByText("An event description long enough to overflow the preview.");
    expect(paragraph.className).toContain("line-clamp-2");
    expect(paragraph.className).toContain("md:line-clamp-3");

    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(paragraph.className).not.toContain("line-clamp-2");
    expect(screen.getByRole("button", { name: "Read less" })).toHaveAttribute("aria-expanded", "true");
  });
});
