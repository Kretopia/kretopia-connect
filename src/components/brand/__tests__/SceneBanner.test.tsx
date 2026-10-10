import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SceneBanner } from "../SceneBanner";

describe("SceneBanner", () => {
  it("is a Kreto scene signed Kretopia, with the feature in the chip", () => {
    const { container } = render(<SceneBanner scene="passport" label="Passport" />);
    expect(container.querySelector('img[src*="scenes/passport"]')).toBeInTheDocument();
    expect(screen.getByText("Kretopia · Passport")).toBeInTheDocument();
    expect(container.querySelector('img[alt="Kretopia"]')).toBeInTheDocument();
  });

  it("says only Kretopia without a label, and nothing when the brand chip is off", () => {
    const { unmount } = render(<SceneBanner scene="scout" />);
    expect(screen.getByText("Kretopia")).toBeInTheDocument();
    unmount();
    render(<SceneBanner scene="scout" brand={false} />);
    expect(screen.queryByText(/Kretopia/)).not.toBeInTheDocument();
  });

  it("is decorative: the picture has no alt text", () => {
    const { container } = render(<SceneBanner scene="match" />);
    const scene = container.querySelector('img[src*="scenes/match"]');
    expect(scene).toHaveAttribute("alt", "");
    expect(scene).toHaveAttribute("aria-hidden", "true");
  });

  it("can melt its bottom edge into the card under it", () => {
    const { container } = render(<SceneBanner scene="assistant" fade />);
    expect(container.querySelector(".bg-gradient-to-t")).toBeInTheDocument();
  });
});
