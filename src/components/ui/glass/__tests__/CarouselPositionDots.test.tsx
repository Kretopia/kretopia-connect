import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CarouselApi } from "@/components/ui/carousel";
import { CarouselPositionDots } from "../CarouselPositionDots";

afterEach(cleanup);

const api = (slides: number, selected = 0) => {
  const scrollTo = vi.fn();
  const value = { scrollSnapList: () => Array.from({ length: slides }, (_, i) => i), selectedScrollSnap: () => selected, on: vi.fn(), off: vi.fn(), scrollTo };
  return { api: value as unknown as CarouselApi, scrollTo };
};

describe("carousel position dots", () => {
  it("draws nothing for a single slide", () => {
    const { container } = render(<CarouselPositionDots api={api(1).api} label="Video" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names every dot and marks the current one", () => {
    render(<CarouselPositionDots api={api(3, 1).api} label="Video" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["Go to slide 1 of 3", "Go to slide 2 of 3", "Go to slide 3 of 3"]);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
  });

  // Regression: the dot itself is 6 px; the button around it was the same size, too small for a thumb.
  it("makes each dot a 24 px touch target, with the small dot drawn inside it", () => {
    render(<CarouselPositionDots api={api(3).api} label="Video" />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toMatch(/(^|\s)h-6(\s|$)/);
      expect(tab.className).toMatch(/(^|\s)min-w-6(\s|$)/);
      expect(tab.querySelector("span")?.className).toContain("h-1.5");
    }
  });

  it("goes to the slide of the dot that is pressed", () => {
    const { api: a, scrollTo } = api(3);
    render(<CarouselPositionDots api={a} label="Video" />);
    fireEvent.click(screen.getByRole("tab", { name: "Go to slide 3 of 3" }));
    expect(scrollTo).toHaveBeenCalledWith(2);
  });
});
