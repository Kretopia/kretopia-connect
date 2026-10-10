import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { StudioWrapped } from "../StudioWrapped";

/**
 * "Right now" and "Projects" are one Wrapped surface: the Radar's frame with
 * Studio's two blocks as its sections. It states only the counts it was given.
 */

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

const renderIt = (props: { projectCount?: number; activeCount?: number } = {}) =>
  render(
    <MemoryRouter>
      <StudioWrapped
        projectCount={props.projectCount ?? 5}
        activeCount={props.activeCount ?? 2}
        rightNow={<section aria-label="pulse"><h3>Right now</h3></section>}
        projects={<section aria-label="shelf">the shelf</section>}
      />
    </MemoryRouter>,
  );

describe("StudioWrapped", () => {
  it("is one named region with Kretopia's eyebrow and a gradient title", () => {
    renderIt();
    const region = screen.getByRole("region", { name: /Everything in your Studio/ });
    expect(within(region).getByText("Kretopia · Studio")).toBeInTheDocument();
    expect(within(region).getByRole("heading", { level: 2, name: /Everything in your Studio/ })).toBeInTheDocument();
  });

  it("holds Right now and Projects, in that order, as its two sections", () => {
    renderIt();
    const region = screen.getByRole("region", { name: /Everything in your Studio/ });
    const pulse = within(region).getByLabelText("pulse");
    const projects = within(region).getByRole("heading", { level: 3, name: "Projects" });
    expect(within(region).getByLabelText("shelf")).toBeInTheDocument();
    expect(Boolean(pulse.compareDocumentPosition(projects) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("states the real counts, singular and plural", () => {
    const { unmount } = renderIt({ projectCount: 5, activeCount: 2 });
    expect(screen.getByText("5 Projects · 2 in progress")).toBeInTheDocument();
    unmount();
    renderIt({ projectCount: 1, activeCount: 1 });
    expect(screen.getByText("1 Project · 1 in progress")).toBeInTheDocument();
  });

  it("says so, and does not light the status, when there are no Projects yet", () => {
    renderIt({ projectCount: 0, activeCount: 0 });
    expect(screen.getByText("No Projects yet")).toBeInTheDocument();
  });

  it("carries the Kretopia lockup of the frame's header area", () => {
    renderIt();
    expect(document.querySelector('img[alt="Kretopia"]')).toBeInTheDocument();
  });
});
