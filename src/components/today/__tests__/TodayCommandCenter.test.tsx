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
    expect(screen.getByRole("button", { name: /Build my Passport/ })).toBeInTheDocument();
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

  it("keeps Passport and Kreto together beside equally structured Today and activity cards", () => {
    const signals = baseSignals({
      passport: { percentage: 72, missingFields: ["Bio"], isComplete: false },
      unreadMessages: 2,
      approvalCount: 1,
      deadlines: [{ id: "t2", title: "Finish deck", projectId: "p2", projectTitle: "Film", dueDate: "2026-09-30", overdue: false }],
      momentum: { completedThisWeek: 3, activeProjects: [], nextMilestone: { title: "Finish deck", projectTitle: "Film", dueDate: "2026-09-30" }, signals: [] },
    });
    renderCommandCenter(signals, { user_id: "u1", full_name: "Maya" } as ProfileRow);
    const card = screen.getByRole("region", { name: "Creative Passport and Kreto" });
    expect(card).toHaveTextContent("My Creative Passport");
    expect(card).toHaveTextContent("Kreto · Creator intelligence");
    const activity = screen.getByRole("region", { name: "Your activity" });
    expect(activity).toHaveTextContent(/2\s*unread messages/);
    expect(activity).toHaveTextContent(/1\s*due in the next 7 days/);
    expect(activity).toHaveTextContent("1 Kreto suggestion to review");
    expect(activity).toHaveTextContent(/3\s*completed this week/);
    expect(activity).toHaveTextContent("Next milestone: Finish deck");
    expect(screen.getByRole("region", { name: "Today's next action" })).toBeInTheDocument();
    expect(card.className).toContain("min-h-[460px]");
    expect(activity.className).toContain("min-h-[460px]");
    expect(screen.getByRole("progressbar", { name: "Passport completion" })).toHaveAttribute("aria-valuenow", "72");
    expect(screen.getByRole("link", { name: /Complete Passport/ })).toHaveAttribute("href", "/passport");
  });

  it("every card has the same anatomy and ends in the Landing CTA pair", () => {
    const priorities: TodaySignals["priority"][] = [
      { kind: "none" },
      { kind: "gig", gig: { id: "g1", title: "Colorist for a music video", company: "Nord Films" } },
      { kind: "approval", approval: { id: "a1", title: "Reach out to Lena", body: "She shortlisted you.", href: null } },
      { kind: "task", task: { id: "t1", title: "Send the deck", projectId: "p1", projectTitle: "Bali", dueDate: "2030-01-01", overdue: false } },
    ];

    for (const priority of priorities) {
      const signals = baseSignals({ priority, passport: { percentage: 40, missingFields: ["Bio"], isComplete: false } });
      const { unmount } = renderCommandCenter(signals, { user_id: "u1", full_name: "Maya" } as ProfileRow);

      const regions = [
        screen.getByRole("region", { name: "Creative Passport and Kreto" }),
        screen.getByRole("region", { name: "Today's next action" }),
        screen.getByRole("region", { name: "Your activity" }),
      ];

      for (const region of regions) {
        // One shell: same height floor, one eyebrow, one title.
        expect(region.className).toContain("min-h-[460px]");
        expect(region.querySelectorAll("header > p")).toHaveLength(1);
        expect(region.querySelectorAll("header > h2")).toHaveLength(1);

        // One CTA pair: the glass primary first, the outline secondary second.
        const pair = Array.from(region.querySelectorAll<HTMLElement>(".glass-cta, a.rounded-full, button.rounded-full"));
        expect(pair).toHaveLength(2);
        expect(pair[0].className).toContain("glass-cta");
        expect(pair[1].className).not.toContain("glass-cta");
        for (const cta of pair) {
          expect(cta.className).toContain("rounded-full");
          expect(cta.className).toContain("w-full");
        }
      }
      unmount();
    }
  });
});
