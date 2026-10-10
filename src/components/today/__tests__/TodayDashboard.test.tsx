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
vi.mock("../radar/TodayRadar", () => ({ TodayRadar: () => <section data-testid="radar" /> }));

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

  it("puts the Radar (next event, events, gigs, people to meet) after the decision cards, never before", () => {
    render(
      <MemoryRouter>
        <TodayDashboard profileFull={profile} />
      </MemoryRouter>,
    );
    const cards = screen.getByTestId("command-center");
    const radar = screen.getByTestId("radar");
    expect(cards.compareDocumentPosition(radar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId("radar")).toHaveLength(1);
  });
});
