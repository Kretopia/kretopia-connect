import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ScoutScanContext, type ScoutScanValue } from "../scoutScanContext";
import { ScoutResultsWrapped } from "../ScoutResultsWrapped";

/**
 * The bottom of Scout is one Wrapped panel: what holds the section switcher,
 * the list and Kreto's panel. It states what it can count and carries the
 * Kretopia lockup.
 */

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

const value = (over: Partial<ScoutScanValue> = {}): ScoutScanValue => ({
  userId: "u1",
  gigs: [{ id: "a" }, { id: "b" }, { id: "c" }] as never,
  loading: false,
  listError: false,
  queryKey: ["scouted-gigs", "u1"],
  actions: [],
  actionsReady: true,
  profile: null,
  progress: { saved: 2, applied: 0, won: 0 },
  lastRunAt: null,
  scanning: false,
  liveRefreshing: false,
  busy: false,
  scanElapsed: 0,
  scanUnavailable: null,
  scanNote: null,
  lastResult: null,
  scanNow: async () => {},
  ...over,
});

const renderIt = (v: ScoutScanValue) =>
  render(
    <MemoryRouter>
      <ScoutScanContext.Provider value={v}>
        <ScoutResultsWrapped>
          <div role="tablist" aria-label="Scout sections" />
          <div data-testid="list">the list</div>
        </ScoutResultsWrapped>
      </ScoutScanContext.Provider>
    </MemoryRouter>,
  );

describe("ScoutResultsWrapped", () => {
  it("is one named region that holds the switcher and the list", () => {
    renderIt(value());
    const region = screen.getByRole("region", { name: /Your opportunities/ });
    expect(within(region).getByRole("tablist", { name: "Scout sections" })).toBeInTheDocument();
    expect(within(region).getByTestId("list")).toBeInTheDocument();
    expect(within(region).getByText("Kretopia · Scout")).toBeInTheDocument();
  });

  it("states the real counts", () => {
    renderIt(value());
    expect(screen.getByText("3 gigs on your list")).toBeInTheDocument();
    expect(screen.getByText(/2 saved/)).toBeInTheDocument();
  });

  it("says one gig in the singular, and nothing yet when there is none", () => {
    const { unmount } = renderIt(value({ gigs: [{ id: "a" }] as never, progress: { saved: 0, applied: 0, won: 0 } }));
    expect(screen.getByText("1 gig on your list")).toBeInTheDocument();
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
    unmount();
    renderIt(value({ gigs: [] }));
    expect(screen.getByText("Nothing on your list yet")).toBeInTheDocument();
  });

  it("says so when the list could not be read, instead of counting zero", () => {
    renderIt(value({ gigs: [], listError: true }));
    expect(screen.getByText("Couldn't load your list")).toBeInTheDocument();
  });

  it("carries the Kretopia lockup at its foot", () => {
    const { container } = renderIt(value());
    const footer = container.querySelector("footer")!;
    expect(footer.querySelector('img[alt="Kretopia"]')).toBeInTheDocument();
  });
});
