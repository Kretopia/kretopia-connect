import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { StudioWrapped } from "../StudioWrapped";

/**
 * Studio's Projects are one Wrapped surface: the Radar's frame, with what needs
 * action above the shelf and the folder filter beside its heading. "Right now",
 * Sound Stage and Quick actions are not part of it. It states only the counts it was given.
 */

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

const renderIt = (props: { projectCount?: number; activeCount?: number } = {}) =>
  render(
    <MemoryRouter>
      <StudioWrapped
        projectCount={props.projectCount ?? 5}
        activeCount={props.activeCount ?? 2}
        aboveProjects={<section aria-label="invitations"><h3>Pending invitations</h3></section>}
        projectControls={<button type="button" aria-label="Filter projects by folder">All projects</button>}
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

  it("holds what needs action above the Projects, in that order", () => {
    renderIt();
    const region = screen.getByRole("region", { name: /Everything in your Studio/ });
    const invitations = within(region).getByLabelText("invitations");
    const projects = within(region).getByRole("heading", { level: 3, name: "Projects" });
    expect(within(region).getByLabelText("shelf")).toBeInTheDocument();
    expect(Boolean(invitations.compareDocumentPosition(projects) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("puts the folder filter beside the Projects heading", () => {
    renderIt();
    const heading = screen.getByRole("heading", { level: 3, name: "Projects" });
    const filter = screen.getByRole("button", { name: "Filter projects by folder" });
    expect(heading.parentElement).toContainElement(filter);
  });

  it("has no Right now, Quick actions or Sound Stage entry of its own", () => {
    renderIt();
    const region = screen.getByRole("region", { name: /Everything in your Studio/ });
    expect(within(region).queryByText(/Right now/i)).not.toBeInTheDocument();
    expect(within(region).queryByText(/Quick actions/i)).not.toBeInTheDocument();
    expect(within(region).queryByText(/Sound ?Stages?/i)).not.toBeInTheDocument();
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
