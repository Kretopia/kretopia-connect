import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

/**
 * The Studio home: header, the New Room, then ONE Wrapped surface holding the
 * Projects (and, above them, the person's pending invitations). "Right now", its
 * Sound Stage row and "Quick actions" are no longer on Studio, and the generic
 * Kreto tip that used to sit above the New Room is gone.
 */

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/components/PageTransition", () => ({ PageTransition: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => <header data-testid="header" /> }));
vi.mock("@/pages/WorkHomeSkeleton", () => ({ WorkHomeSkeleton: () => <div data-testid="skeleton" /> }));
vi.mock("@/components/project/studio/useStudioGlobalModals", () => ({
  useStudioGlobalModals: () => ({ modals: null, openCreateProject: vi.fn(), openVoiceCommand: vi.fn(), openPalette: vi.fn(), openWrapWeek: vi.fn() }),
}));
vi.mock("@/components/project/studio/StudioCreateHero", () => ({ StudioCreateHero: () => <section data-testid="new-room" aria-label="New Room" /> }));
vi.mock("@/components/project/MyPendingInvitations", () => ({ MyPendingInvitations: () => <section data-testid="invitations" aria-label="Pending invitations" /> }));
vi.mock("@/components/project/studio/StudioProjectsDashboard", () => ({ StudioProjectsDashboard: () => <section data-testid="projects" aria-label="Studio projects" /> }));
vi.mock("@/components/agent/KretoTip", () => ({ KretoTip: () => <aside data-testid="kreto-tip">Drop a brief or a voice note. Turn it into a plan</aside> }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const rows: Record<string, unknown[]> = {
  projects: [
    { id: "p1", title: "Nord film", status: "active", updated_at: "2026-10-01T00:00:00Z", created_by: "u1" },
    { id: "p2", title: "Sud EP", status: "completed", updated_at: "2026-09-01T00:00:00Z", created_by: "u1" },
  ],
};

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit", "update"]) q[m] = () => q;
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows[table] ?? [], error: null }).then(res, rej);
    return q;
  };
  return { supabase: { from: (t: string) => chain(t), rpc: () => Promise.resolve({ data: [], error: null }) } };
});

import CreatorWorkHome from "../CreatorWorkHome";

const renderHome = () =>
  render(
    <MemoryRouter>
      <CreatorWorkHome />
    </MemoryRouter>,
  );

const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("Studio home (creator)", () => {
  it("preserves the same project workspace and adds real hiring actions for Company", async () => {
    render(<MemoryRouter><CreatorWorkHome company /></MemoryRouter>);
    const wrapped = await screen.findByRole("region", { name: /Everything in your Studio/ });
    expect(within(wrapped).getByTestId("projects")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a Gig" })).toHaveAttribute("href", "/post-opportunity");
    expect(screen.getByRole("link", { name: "Find talent" })).toHaveAttribute("href", "/talent-finder");
    expect(screen.getByRole("link", { name: "Pay creators" })).toHaveAttribute("href", "/thrivepay");
  });
  it("no longer shows the generic Kreto tip above the New Room", async () => {
    renderHome();
    await screen.findByTestId("new-room");
    expect(screen.queryByTestId("kreto-tip")).not.toBeInTheDocument();
    expect(screen.queryByText(/Drop a brief or a voice note/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Turn it into a plan/)).not.toBeInTheDocument();
  });

  it("order: header, the New Room, then the one Wrapped surface", async () => {
    renderHome();
    const hero = await screen.findByTestId("new-room");
    const wrapped = screen.getByRole("region", { name: /Everything in your Studio/ });
    expect(before(screen.getByTestId("header"), hero)).toBe(true);
    expect(before(hero, wrapped)).toBe(true);
  });

  it("holds the pending invitations above the Projects, inside the one Wrapped surface", async () => {
    renderHome();
    const wrapped = await screen.findByRole("region", { name: /Everything in your Studio/ });
    const invitations = within(wrapped).getByTestId("invitations");
    expect(within(wrapped).getByTestId("projects")).toBeInTheDocument();
    expect(before(invitations, within(wrapped).getByTestId("projects"))).toBe(true);
  });

  it("has no Right now, Quick actions or Sound Stage entry anywhere on Studio", async () => {
    renderHome();
    await screen.findByRole("region", { name: /Everything in your Studio/ });
    expect(screen.queryByText(/Right now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Quick actions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sound ?Stages?/i)).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="soundstages"], a[href*="sound-stages"]')).toBeNull();
  });

  it("states the real Project counts in the Wrapped header", async () => {
    renderHome();
    await waitFor(() => expect(screen.getByText("2 Projects · 1 in progress")).toBeInTheDocument());
  });
});
