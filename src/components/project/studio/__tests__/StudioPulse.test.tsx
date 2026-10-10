import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StudioPulse } from "../StudioPulse";

/**
 * StudioPulse's own job is composition: the "Right now" heading, and
 * rendering SpeedTonightCard / StudioActivitySummary / pending invitations /
 * the contextual quick-actions strip -- NOT reimplementing what any of them
 * show. StudioActivitySummary's own condensed-row behavior (Sound Stage/
 * Crew/Casting/Recordings, collapsed by default) is covered by
 * StudioActivitySummary.test.tsx; it's stubbed here to a thin marker so this
 * file stays focused on composition, same as every other child.
 */
vi.mock("@/components/project/studio/StudioActivitySummary", () => ({
  StudioActivitySummary: ({ recentCollaborators }: { recentCollaborators: unknown[] }) => (
    <div data-testid="studio-activity-summary" data-count={recentCollaborators.length} />
  ),
}));
vi.mock("@/components/home/SpeedTonightCard", () => ({
  SpeedTonightCard: () => <div data-testid="speed-tonight-card" />,
}));
vi.mock("@/components/desk/TodayStrip", () => ({
  TodayStrip: () => <div data-testid="today-strip" />,
}));
vi.mock("@/components/project/MyPendingInvitations", () => ({
  MyPendingInvitations: () => <div data-testid="pending-invitations" />,
}));

const baseProps = { onVoice: vi.fn(), onCommandPalette: vi.fn(), onWrapWeek: vi.fn() };

const renderPulse = (recentCollaborators: { id: string; full_name: string; avatar_url: string | null; role: string | null }[] = []) =>
  render(
    <MemoryRouter>
      <StudioPulse recentCollaborators={recentCollaborators} {...baseProps} />
    </MemoryRouter>,
  );

describe("StudioPulse", () => {
  it("labels the section 'Right now', not a generic/duplicate heading", () => {
    renderPulse();
    expect(screen.getByRole("heading", { name: "Right now" })).toBeInTheDocument();
  });

  it("as a section of a Wrapped panel it keeps the label but draws no surface of its own", () => {
    const { container } = render(
      <MemoryRouter>
        <StudioPulse recentCollaborators={[]} {...baseProps} variant="wrapped" />
      </MemoryRouter>,
    );
    // a sub-heading of the panel, not a second page-level heading
    expect(screen.getByRole("heading", { level: 3, name: "Right now" })).toBeInTheDocument();
    const section = container.querySelector("section")!;
    expect(section.className).not.toContain("border");
    expect(section.className).not.toContain("bg-card");
  });

  it("renders every sub-widget without reimplementing them, passing real collaborators through", () => {
    const collabs = [{ id: "c1", full_name: "Maya Chen", avatar_url: null, role: "Editor" }];
    renderPulse(collabs);
    expect(screen.getByTestId("speed-tonight-card")).toBeInTheDocument();
    expect(screen.getByTestId("studio-activity-summary")).toHaveAttribute("data-count", "1");
    expect(screen.getByTestId("pending-invitations")).toBeInTheDocument();
    expect(screen.getByTestId("today-strip")).toBeInTheDocument();
  });
});
