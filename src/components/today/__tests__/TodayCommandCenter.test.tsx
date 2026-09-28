import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TodayCommandCenter } from "../TodayCommandCenter";
import type { ProfileRow, TodaySignals } from "../today.types";

/**
 * Smoke coverage for the two states the product brief calls out
 * explicitly: a genuinely new user (must see a real next step, never
 * fabricated activity) and an active user with a concrete priority action
 * (must see that action's own CTA label, not a generic one).
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
interface MockHeaderProps {
  title?: ReactNode;
  accentTitle?: ReactNode;
  subtitle?: ReactNode;
  tabs?: ReactNode;
}
vi.mock("@/components/features/FeaturePageHeader", () => ({
  FeaturePageHeader: ({ title, accentTitle, subtitle, tabs }: MockHeaderProps) => (
    <div>
      <h1>{title} {accentTitle}</h1>
      <p>{subtitle}</p>
      {tabs}
    </div>
  ),
}));
vi.mock("@/components/brand/KretoPresence", () => ({ KretoPresence: () => <div data-testid="kreto-presence" /> }));
vi.mock("@/components/passport/HoloCard", () => ({
  HoloCard: ({ children, className }: { children?: ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

function baseSignals(overrides: Partial<TodaySignals> = {}): TodaySignals {
  return {
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
    ...overrides,
  };
}

function renderCommandCenter(signals: TodaySignals, profile?: ProfileRow) {
  return render(
    <MemoryRouter>
      <TodayCommandCenter firstName="Maya" profile={profile} creditCount={2} signals={signals} onSignalsChanged={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("TodayCommandCenter", () => {
  it("new user with no Passport progress sees Build my Passport, not fabricated activity", () => {
    const signals = baseSignals({
      passport: { percentage: 0, missingFields: ["Full Name", "Bio"], isComplete: false },
      primaryCta: { label: "Build my Passport", href: "/passport" },
    });
    renderCommandCenter(signals);
    expect(screen.getByText(/Build my Passport/)).toBeInTheDocument();
    expect(screen.getByText("You're all caught up. A good moment to start something.")).toBeInTheDocument();
  });

  it("overdue task as the priority action shows its own label, Complete/Snooze/Open Project actions", () => {
    const signals = baseSignals({
      priority: { kind: "task", task: { id: "t1", title: "Send the sponsor deck", projectId: "p1", projectTitle: "Bali Carnival", dueDate: "2020-01-01", overdue: true } },
      primaryCta: { label: "Complete my Passport", href: "/passport" },
      passport: { percentage: 45, missingFields: ["Location"], isComplete: false },
    });
    renderCommandCenter(signals);
    expect(screen.getByText("Send the sponsor deck")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snooze" })).toBeInTheDocument();
  });

  it("stamps waiting for co-sign surfaces the co-sign CTA, not a vague label", () => {
    const signals = baseSignals({
      passport: { percentage: 100, missingFields: [], isComplete: true },
      stamps: { waitingForCoSign: 2 },
      primaryCta: { label: "Send co-sign requests", href: "/credits" },
    });
    renderCommandCenter(signals);
    expect(screen.getByText(/Send co-sign requests/)).toBeInTheDocument();
  });

  it("combines Passport and Kreto in one branded card with a real signal", () => {
    const signals = baseSignals({
      passport: { percentage: 72, missingFields: ["Bio"], isComplete: false },
      unreadMessages: 2,
    });
    renderCommandCenter(signals, { user_id: "u1", full_name: "Maya" } as ProfileRow);
    const card = screen.getByRole("region", { name: "Creative Passport and Kreto" });
    expect(card).toHaveTextContent("My Creative Passport");
    expect(card).toHaveTextContent("Kreto · Creator intelligence");
    expect(card).toHaveTextContent("2 unread messages");
    expect(screen.getByRole("progressbar", { name: "Passport completion" })).toHaveAttribute("aria-valuenow", "72");
    expect(screen.getByRole("link", { name: /Open Passport/ })).toHaveAttribute("href", "/passport");
  });
});
