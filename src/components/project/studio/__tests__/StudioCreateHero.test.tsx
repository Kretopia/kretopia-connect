import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { StudioCreateHero } from "../StudioCreateHero";

/**
 * The New Room: signed with Kretopia's own marks, one primary and one
 * secondary CTA (the Landing pair, equal tracks), and the same promise in the
 * same words.
 */

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

const setup = (props: { projectCount?: number; activeCount?: number } = {}) => {
  const h = { onCreate: vi.fn(), onVoice: vi.fn() };
  const view = render(
    <MemoryRouter>
      <StudioCreateHero {...h} projectCount={props.projectCount ?? 0} activeCount={props.activeCount ?? 0} />
    </MemoryRouter>,
  );
  return { ...h, ...view };
};

describe("StudioCreateHero", () => {
  it("keeps the promise in its own words", () => {
    setup();
    const title = screen.getByRole("heading", { level: 2 });
    expect(title).toHaveTextContent("Say what you're making.");
    expect(title).toHaveTextContent("Kreto builds the room.");
  });

  it("is signed with Kretopia's lockup (the real K and wordmark)", () => {
    const { container } = setup();
    expect(container.querySelector('img[alt="Kretopia"]')).toBeInTheDocument();
    expect(container.querySelector('img[alt="kretopia"]')).toBeInTheDocument();
    expect(container.querySelectorAll('img[src*="kretopia-k-mark"]')).toHaveLength(1);
  });

  it("shows Kreto at his Studio desk, as decorative art", () => {
    const { container } = setup();
    const scene = container.querySelector('img[src*="scenes/studio"]');
    expect(scene).toBeInTheDocument();
    expect(scene).toHaveAttribute("alt", "");
  });

  it("has one primary and one secondary CTA, in equal tracks", () => {
    const { container } = setup();
    const primary = screen.getByRole("button", { name: "Open a New Room" });
    const secondary = screen.getByRole("button", { name: "Describe it out loud" });
    expect(primary).toHaveAttribute("data-testid", "studio-create-project");
    expect(primary.parentElement).toBe(secondary.parentElement);
    expect(primary.parentElement?.className).toContain("sm:grid-cols-2");
    // the Landing pair: glass primary, outlined secondary
    expect(primary.className).toContain("glass-cta");
    expect(secondary.className).toContain("border-border");
    expect(container.querySelectorAll('[data-testid="studio-create-project"]')).toHaveLength(1);
  });

  it("both CTAs and the prompt line open the New Room flow, and nothing else", () => {
    const h = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open a New Room" }));
    fireEvent.click(screen.getByRole("button", { name: "Open the New Room" }));
    expect(h.onCreate).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Describe it out loud" }));
    expect(h.onVoice).toHaveBeenCalledTimes(1);
  });

  it("states real counts only", () => {
    const { unmount } = setup({ projectCount: 0 });
    expect(screen.getByText("Your first Project takes about a minute to set up.")).toBeInTheDocument();
    unmount();
    setup({ projectCount: 4, activeCount: 2 });
    expect(screen.getByText("4 Projects in Studio · 2 in progress")).toBeInTheDocument();
  });

  it("lists what a New Room produces, as three plain tiles", () => {
    setup();
    const tiles = screen.getAllByRole("listitem");
    expect(tiles.map((t) => within(t).getByText(/Brief|Work|Wrap/).textContent)).toEqual(["Brief", "Work", "Wrap"]);
  });
});
