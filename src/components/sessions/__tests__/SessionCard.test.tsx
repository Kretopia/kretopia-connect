import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: { id: "viewer" } as { id: string } | null,
  toast: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  email: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: m.user }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/utils/eventConfirmationEmail", () => ({ sendEventConfirmationEmail: (...a: unknown[]) => m.email(...a) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => { m.insert(row); return { select: () => ({ single: () => Promise.resolve({ data: { id: "p1" } }) }) }; },
      delete: () => ({ eq: () => ({ eq: () => { m.remove(); return Promise.resolve({}); } }) }),
    }),
  },
}));

import { SessionCard } from "../SessionCard";

const base = {
  id: "s1", title: "Beat Lab", description: "Bring stems.", category: "music", venue_name: "Studio Nine", start_time: "2099-01-10T18:30:00.000Z",
  max_participants: 10, participant_count: 3, distance_km: 2.4, creator_name: "Jo", created_by: "host", cover_image_url: undefined as string | undefined,
};
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const draw = (session: Partial<typeof base> & Record<string, unknown> = {}, props: { compact?: boolean; onClick?: () => void; onJoin?: () => void; userParticipation?: "going" | null } = {}) =>
  render(
    <MemoryRouter initialEntries={["/meetup"]}>
      <Routes>
        <Route path="/meetup" element={<SessionCard session={{ ...base, ...session }} {...props} />} />
        <Route path="/event/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
const card = () => screen.getByTestId("session-card-s1");

beforeEach(() => {
  m.user = { id: "viewer" };
  m.toast.mockReset();
  m.insert.mockReset();
  m.remove.mockReset();
  m.email.mockReset();
  m.writeText.mockReset();
  vi.stubGlobal("open", vi.fn());
  // jsdom has no clipboard, and no Web Share: sharing falls back to copying the link.
  Object.defineProperty(navigator, "clipboard", { value: { writeText: m.writeText }, configurable: true });
});

describe.each([["the card, for a grid", false], ["the row, for a list beside other rows", true]])("SessionCard as %s", (_name, compact) => {
  it("says what the event is, who hosts it, when, how many are going and where", () => {
    draw({}, { compact });
    expect(within(card()).getByText("Beat Lab")).toBeInTheDocument();
    expect(card().querySelector('[data-card-part="meta"]')).toHaveTextContent("Jo");
    expect(card()).toHaveTextContent("Music");
    expect(card()).toHaveTextContent("3/10");
    expect(card()).toHaveTextContent("Studio Nine · 2.4km");
    expect(card()).toHaveTextContent(/Jan 10/);
  });

  it("joins a free event in one press, says Going, and leaves again from the same button", async () => {
    const onJoin = vi.fn();
    draw({}, { compact, onJoin });
    fireEvent.click(within(card()).getByRole("button", { name: "Join" }));
    await waitFor(() => expect(within(card()).getByRole("button", { name: /Going/ })).toBeInTheDocument());
    expect(m.insert).toHaveBeenCalledWith({ jam_id: "s1", user_id: "viewer", status: "going" });
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(onJoin).toHaveBeenCalledTimes(1);
    fireEvent.click(within(card()).getByRole("button", { name: /Going/ }));
    await waitFor(() => expect(within(card()).getByRole("button", { name: "Join" })).toBeInTheDocument());
    expect(m.remove).toHaveBeenCalledTimes(1);
  });

  it("does not join a ticketed event for free: the event page opens instead", async () => {
    draw({ is_ticketed: true, ticket_price: 12, ticket_currency: "EUR" }, { compact });
    expect(card()).toHaveTextContent("€12");
    fireEvent.click(within(card()).getByRole("button", { name: /Get Ticket/ }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/event/s1"));
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("sends tickets sold elsewhere to that link, with no guest-list row", () => {
    draw({ is_ticketed: true, ticket_price: 12, external_ticket_url: "https://tickets.example/s1" }, { compact });
    fireEvent.click(within(card()).getByRole("button", { name: /Get Ticket/ }));
    expect(window.open).toHaveBeenCalledWith("https://tickets.example/s1", "_blank", "noopener,noreferrer");
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("will not take a place in a full event", () => {
    draw({ participant_count: 10 }, { compact });
    expect(card()).toHaveTextContent("10/10 · Full");
    expect(within(card()).getByRole("button", { name: /Full/ })).toBeDisabled();
  });

  it("offers a signed-out visitor no way to join without telling them why", async () => {
    m.user = null;
    draw({}, { compact });
    fireEvent.click(within(card()).getByRole("button", { name: "Join" }));
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Not authenticated" })));
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("gives the host no join button, and an event that has ended none either, and says which it is", () => {
    const { unmount } = draw({ created_by: "viewer" }, { compact });
    expect(within(card()).queryByRole("button", { name: /Join|Going|Ticket|Full/ })).toBeNull();
    expect(card()).toHaveTextContent("Hosting");
    unmount();
    draw({ start_time: "2020-01-10T18:30:00.000Z" }, { compact });
    expect(within(card()).queryByRole("button", { name: /Join|Going|Ticket|Full/ })).toBeNull();
    expect(card()).toHaveTextContent("Ended");
  });

  it("opens the event from the card, and joining or sharing never opens it", async () => {
    const onClick = vi.fn();
    draw({}, { compact, onClick });
    fireEvent.click(within(card()).getByRole("button", { name: "Beat Lab" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.click(within(card()).getByRole("button", { name: "Share event" }));
    fireEvent.click(within(card()).getByRole("button", { name: "Join" }));
    await waitFor(() => expect(m.insert).toHaveBeenCalledTimes(1));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("with no handler the title is a real link to the event page", () => {
    draw({}, { compact });
    expect(within(card()).getByRole("link", { name: "Beat Lab" })).toHaveAttribute("href", "/event/s1");
  });

  it("copies the event link when the browser cannot share, and says so", () => {
    draw({}, { compact });
    fireEvent.click(within(card()).getByRole("button", { name: "Share event" }));
    expect(m.writeText).toHaveBeenCalledWith(expect.stringMatching(/\/event\/s1$/));
    expect(m.toast).toHaveBeenCalledWith({ title: "Link copied!" });
  });
});

describe("SessionCard: the two forms are the shared card and its row", () => {
  it("the card is the event variant of the shell, with a 16:9 cover; the row is the compact form, with none", () => {
    const { unmount } = draw({}, { compact: false });
    expect(card().querySelector('[data-card-part="cover"]')!.className).toContain("aspect-[16/9]");
    unmount();
    draw({}, { compact: true });
    expect(card()).toHaveAttribute("data-card-part", "row");
    expect(card().querySelector('[data-card-part="cover"]')).toBeNull();
  });

  it("keeps the description on a row only when there is no picture, as before", () => {
    const { unmount } = draw({}, { compact: true });
    expect(card().querySelector('[data-card-part="description"]')).toHaveTextContent("Bring stems.");
    unmount();
    draw({ cover_image_url: "https://x.test/c.jpg" }, { compact: true });
    expect(card().querySelector('[data-card-part="description"]')).toBeNull();
  });
});
