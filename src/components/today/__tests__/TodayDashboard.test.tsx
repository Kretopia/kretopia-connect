import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TodayDashboard } from "../TodayDashboard";
import type { ProfileRow } from "../today.types";

/**
 * Today keeps only the command center without a second Passport dashboard.
 */

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("../today.selectors", () => ({
  useTodaySignals: () => ({
    loading: false,
    error: null,
    isNewUser: false,
    priority: { kind: "none" },
    primaryCta: { label: "Ask Kreto", event: "thrive-copilot:open" },
    passport: null,
    stamps: null,
    momentum: null,
    approvalCount: 0,
    deadlines: [],
    unreadMessages: 0,
    reload: vi.fn(),
  }),
}));
vi.mock("../TodayCommandCenter", () => ({ TodayCommandCenter: () => <div data-testid="command-center" /> }));
vi.mock("../TodayDiscoverCreatives", () => ({ TodayDiscoverCreatives: () => <section data-testid="discover-creatives" /> }));
vi.mock("../TodayNextEvent", () => ({ TodayNextEvent: () => <section data-testid="next-event" /> }));

const profile = { user_id: "u1", full_name: "Maya" } as unknown as ProfileRow;

describe("TodayDashboard — focused overview", () => {
  it("renders the command center without secondary dashboards", () => {
    render(
      <MemoryRouter>
        <TodayDashboard profileFull={profile} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("command-center")).toBeInTheDocument();
    expect(screen.queryByTestId("opportunities")).not.toBeInTheDocument();
    expect(screen.queryByText("Your Passport dashboard")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metrics-dashboard")).not.toBeInTheDocument();
  });

  it("puts Discover Creatives after the decision cards, never before", () => {
    render(
      <MemoryRouter>
        <TodayDashboard profileFull={profile} />
      </MemoryRouter>,
    );
    const cards = screen.getByTestId("command-center");
    const nextEvent = screen.getByTestId("next-event");
    const discover = screen.getByTestId("discover-creatives");
    expect(cards.compareDocumentPosition(nextEvent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nextEvent.compareDocumentPosition(discover) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cards.compareDocumentPosition(discover) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
