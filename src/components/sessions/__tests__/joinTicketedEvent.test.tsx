import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inserts: [] as unknown[],
  invoke: vi.fn(),
  toast: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mocks.invoke(...a) },
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        insert: (row: unknown) => { if (table === "jam_participants") mocks.inserts.push(row); return chain; },
        delete: () => chain,
        single: () => Promise.resolve({ data: { id: "part-1" }, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (ok: any) => Promise.resolve({ data: [], error: null }).then(ok),
      };
      return chain;
    },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/utils/eventConfirmationEmail", () => ({ sendEventConfirmationEmail: (...a: unknown[]) => mocks.email(...a) }));

import { SessionCard } from "../SessionCard";
import { SessionDetailDialog } from "../SessionDetailDialog";

const base = {
  id: "ev1",
  title: "Beat night",
  category: "music",
  start_time: "2099-01-01T20:00:00Z",
  max_participants: 50,
  participant_count: 3,
  creator_name: "Host",
  created_by: "host",
  status: "upcoming",
};

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}
const inRouter = (ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={["/discover"]}>
      <Routes>
        <Route path="*" element={<>{ui}<Where /></>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.inserts.length = 0;
  mocks.invoke.mockReset();
  mocks.toast.mockReset();
  mocks.email.mockReset();
  vi.spyOn(window, "open").mockImplementation(() => null);
});

describe("SessionCard: joining", () => {
  const join = () => fireEvent.click(screen.getAllByRole("button").find((b) => /join|going|ticket|rsvp/i.test(b.textContent || "")) || screen.getAllByRole("button")[0]);

  it("a ticketed event is not joined for free: no guest-list row, the event page opens instead", async () => {
    inRouter(<SessionCard session={{ ...base, is_ticketed: true, ticket_price: undefined } as any} />);
    join();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/event/ev1"));
    expect(mocks.inserts).toHaveLength(0);
  });

  it("an event whose tickets are sold elsewhere opens that link, with no guest-list row", async () => {
    inRouter(<SessionCard session={{ ...base, is_ticketed: false, external_ticket_url: "https://tickets.example/1" } as any} />);
    join();
    await waitFor(() => expect(window.open).toHaveBeenCalledWith("https://tickets.example/1", "_blank", "noopener,noreferrer"));
    expect(mocks.inserts).toHaveLength(0);
  });

  it("a free event is still joined in one tap", async () => {
    inRouter(<SessionCard session={{ ...base, is_ticketed: false } as any} />);
    join();
    await waitFor(() => expect(mocks.inserts).toHaveLength(1));
    expect(mocks.inserts[0]).toMatchObject({ jam_id: "ev1", user_id: "me", status: "going" });
    expect(screen.getByTestId("where")).toHaveTextContent("/discover");
  });
});

describe("SessionDetailDialog: joining", () => {
  const open = (session: Record<string, unknown>) =>
    inRouter(<SessionDetailDialog session={{ ...base, ...session } as any} open onOpenChange={() => {}} onRefresh={() => {}} />);

  it("a tiered ticketed event (no single price) used to fall into the free join; it now goes to the event page", async () => {
    open({ is_ticketed: true, ticket_price: undefined });
    fireEvent.click(await screen.findByRole("button", { name: /Get Ticket/ }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/event/ev1"));
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("a single-price ticketed event still starts the Stripe checkout, with no guest-list row", async () => {
    mocks.invoke.mockResolvedValue({ data: { url: "https://checkout.example/s" }, error: null });
    open({ is_ticketed: true, ticket_price: 25, ticket_currency: "USD" });
    // The dialog shows the same "Get Ticket" action twice (header and tickets tab); either is the real one.
    fireEvent.click((await screen.findAllByRole("button", { name: /Get Ticket/ }))[0]);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("purchase-event-ticket", { body: { eventId: "ev1" } }));
    expect(mocks.inserts).toHaveLength(0);
  });

  it("a free event is still joined directly", async () => {
    open({ is_ticketed: false });
    fireEvent.click(await screen.findByRole("button", { name: /Join Event/ }));
    await waitFor(() => expect(mocks.inserts).toHaveLength(1));
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
