import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composeBriefMessage } from "@/lib/collabBrief";

const h = vi.hoisted(() => ({ notifications: [] as unknown[], auth: { user: { id: "me" }, loading: false } }));
// One stable object: the component re-reads its invitations whenever `user` changes identity.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => h.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
    from: (table: string) => {
      const rows =
        table === "project_collaborators"
          ? [{ id: "inv1", project_id: "p1", invited_by: "ada", invited_at: new Date().toISOString(), agent_role: "creative", projects: { id: "p1", title: "Neon Nights", description: "Plain project description." } }]
          : table === "notifications"
            ? h.notifications
            : { full_name: "Ada Okoye", avatar_url: null };
      const q: Record<string, unknown> = {};
      q.select = q.eq = q.in = q.order = q.limit = () => q;
      q.single = async () => ({ data: rows });
      q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
      return q;
    },
  },
}));

import { MyPendingInvitations } from "../MyPendingInvitations";

afterEach(cleanup);

const BRIEF = {
  summary: "A four-minute music video for Maya Rios's single, shot over two nights in Lisbon.",
  reason: "Your handheld night work on Static Bloom is exactly the look Maya wants.",
};
const withBrief = () => [
  { link: "/desk/p1", message: "Ada Okoye invited you to Neon Nights", created_at: "2026-11-03T10:00:01Z" },
  { link: "/desk/p1", message: composeBriefMessage("Ada Okoye invited you to collaborate on Neon Nights.", BRIEF), created_at: "2026-11-03T10:00:00Z" },
];

const renderCards = (compact = false) => render(<MemoryRouter><MyPendingInvitations compact={compact} /></MemoryRouter>);

describe("the recipient reads the brief in the request", () => {
  it("shows both halves on the invitation card, passing over the generic notification that has no brief", async () => {
    h.notifications = withBrief();
    renderCards();
    const brief = await screen.findByTestId("invitation-brief");
    expect(brief).toHaveTextContent(BRIEF.summary);
    expect(brief).toHaveTextContent(BRIEF.reason);
    expect(screen.queryByText("Plain project description.")).toBeNull();
  });

  it("falls back to the project's description for a request sent before briefs were required", async () => {
    h.notifications = [{ link: "/desk/p1", message: "Ada Okoye invited you to Neon Nights", created_at: "2026-11-03T10:00:00Z" }];
    renderCards();
    expect(await screen.findByText("Plain project description.")).toBeInTheDocument();
    expect(screen.queryByTestId("invitation-brief")).toBeNull();
  });

  it("keeps the Studio row compact, with the brief one press away", async () => {
    h.notifications = withBrief();
    renderCards(true);
    const toggle = await screen.findByRole("button", { name: /Brief/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("invitation-brief")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(screen.getByTestId("invitation-brief")).toHaveTextContent(BRIEF.reason));
  });

  it("offers no Brief control on a request that has none", async () => {
    h.notifications = [];
    renderCards(true);
    await screen.findByText("Neon Nights");
    expect(screen.queryByRole("button", { name: /^Brief/ })).toBeNull();
  });
});
