import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StudioActivitySummary } from "../StudioActivitySummary";

/**
 * CEO hotfix (24/09/2026): Sound Stage/Crew/Casting/Recordings condensed
 * from four always-expanded rails into one status line each, collapsed by
 * default (native <details>, opened via its <summary>). Every real child
 * widget is stubbed here -- what's under test is the summary line text
 * StudioActivitySummary itself computes from each one's reported count,
 * and that expanding a row actually reveals that widget's real content.
 */

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  liveCount: null as number | null,
  castingCount: null as number | null,
  recordingsCount: null as number | null,
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

vi.mock("@/components/circle/SoundStagesRail", () => ({
  SoundStagesRail: ({ onLoad }: { onLoad?: (n: number) => void }) => {
    useEffect(() => {
      if (mocks.liveCount !== null) onLoad?.(mocks.liveCount);
    }, [onLoad]);
    return <div data-testid="sound-stages-rail" />;
  },
}));
vi.mock("@/components/opportunity/CastingCallsRail", () => ({
  CastingCallsRail: ({ onLoad }: { onLoad?: (n: number) => void }) => {
    useEffect(() => {
      if (mocks.castingCount !== null) onLoad?.(mocks.castingCount);
    }, [onLoad]);
    return <div data-testid="casting-calls-rail" />;
  },
}));
vi.mock("@/components/calls/RecentRecordingsRail", () => ({
  RecentRecordingsRail: ({ onLoad }: { onLoad?: (n: number) => void }) => {
    useEffect(() => {
      if (mocks.recordingsCount !== null) onLoad?.(mocks.recordingsCount);
    }, [onLoad]);
    return <div data-testid="recent-recordings-rail" />;
  },
}));

beforeEach(() => {
  mocks.liveCount = null;
  mocks.castingCount = null;
  mocks.recordingsCount = null;
  mocks.navigate.mockClear();
  // jsdom has neither observer; the real (unmocked) crew carousel uses
  // embla-carousel, which requires both to initialize at all.
  // @ts-expect-error -- minimal stubs, only existence is required here.
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const renderSummary = (recentCollaborators: { id: string; full_name: string; avatar_url: string | null; role: string | null }[] = []) =>
  render(
    <MemoryRouter>
      <StudioActivitySummary recentCollaborators={recentCollaborators} />
    </MemoryRouter>,
  );

describe("StudioActivitySummary", () => {
  it("collapses every row by default (native <details>, not pre-opened)", () => {
    const { container } = renderSummary();
    const rows = container.querySelectorAll("details");
    expect(rows.length).toBe(4);
    rows.forEach((row) => expect(row).not.toHaveAttribute("open"));
  });

  it("says 'checking…' before a real count is known, never a fake status", () => {
    renderSummary();
    expect(screen.getByText(/Sound Stage/).closest("summary")).toHaveTextContent("checking…");
  });

  it("shows the real live count once known, including zero", () => {
    mocks.liveCount = 0;
    renderSummary();
    expect(screen.getByText(/Sound Stage/).closest("summary")).toHaveTextContent("nothing on air");
  });

  it("shows a real live session count when one exists", () => {
    mocks.liveCount = 3;
    renderSummary();
    expect(screen.getByText(/Sound Stage/).closest("summary")).toHaveTextContent("3 live now");
  });

  it("expanding a row mounts its real widget", () => {
    renderSummary();
    fireEvent.click(screen.getByText("Sound Stage"));
    expect(screen.getByTestId("sound-stages-rail")).toBeInTheDocument();
  });

  it("shows a 'build your crew' status with a working Invite action when there are no collaborators", () => {
    renderSummary([]);
    expect(screen.getByText(/Crew/).closest("summary")).toHaveTextContent("build your crew");
    fireEvent.click(screen.getByRole("button", { name: /Invite/ }));
    expect(mocks.navigate).toHaveBeenCalledWith("/post-opportunity");
  });

  it("shows the real collaborator count and reveals them on expand", () => {
    renderSummary([{ id: "c1", full_name: "Maya Chen", avatar_url: null, role: "Editor" }]);
    expect(screen.getByText(/Crew/).closest("summary")).toHaveTextContent("1 recent");
    fireEvent.click(screen.getByText("Crew"));
    fireEvent.click(screen.getByText("Maya Chen"));
    expect(mocks.navigate).toHaveBeenCalledWith("/profile/c1");
  });

  it("shows the real casting count and a Post a call action", () => {
    mocks.castingCount = 2;
    renderSummary();
    expect(screen.getByText(/Casting/).closest("summary")).toHaveTextContent("2 open calls");
    fireEvent.click(screen.getByRole("button", { name: /Post a call/ }));
    expect(mocks.navigate).toHaveBeenCalledWith("/post-opportunity");
  });

  it("shows the real recordings count", () => {
    mocks.recordingsCount = 5;
    renderSummary();
    expect(screen.getByText(/Recordings/).closest("summary")).toHaveTextContent("5 recent");
  });

  it("collapses to a single 'nothing happening' line only once every section is confirmed empty", () => {
    mocks.liveCount = 0;
    mocks.castingCount = 0;
    mocks.recordingsCount = 0;
    renderSummary([]);
    expect(screen.getByText("Nothing happening right now.")).toBeInTheDocument();
    expect(screen.queryByText("Sound Stage")).not.toBeInTheDocument();
  });

  it("does not claim 'nothing happening' while any count is still unknown", () => {
    renderSummary([]); // no counts set -- all still "checking…"
    expect(screen.queryByText("Nothing happening right now.")).not.toBeInTheDocument();
  });
});
