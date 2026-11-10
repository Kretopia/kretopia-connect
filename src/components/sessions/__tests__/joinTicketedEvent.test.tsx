import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inserts: [] as unknown[],
  updates: [] as unknown[],
  participation: null as string | null,
  invoke: vi.fn(),
  rpc: vi.fn(),
  toast: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mocks.invoke(...a) },
    rpc: (...a: unknown[]) => mocks.rpc(...a),
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        insert: (row: unknown) => { if (table === "jam_participants") mocks.inserts.push(row); return chain; },
        update: (payload: unknown) => { mocks.updates.push({ table, payload }); return chain; },
        delete: () => chain,
        single: () => Promise.resolve({ data: { id: "part-1" }, error: null }),
        maybeSingle: () => Promise.resolve({ data: mocks.participation ? { status: mocks.participation } : null, error: null }),
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
  mocks.updates.length = 0;
  mocks.participation = null;
  mocks.invoke.mockReset();
  mocks.rpc.mockReset().mockResolvedValue({ data: "joined", error: null });
  mocks.toast.mockReset();
  mocks.email.mockReset();
  vi.spyOn(window, "open").mockImplementation(() => null);
});

describe("SessionCard: joining", () => {
  const join = () => fireEvent.click(screen.getAllByRole("button").find((b) => /join|going|ticket|rsvp/i.test(b.textContent || "")) || screen.getAllByRole("button")[0]);

  it("native ticket bookings remain disabled until server capacity and payment confirmation are available", async () => {
    inRouter(<SessionCard session={{ ...base, is_ticketed: true, ticket_price: undefined } as any} />);
    expect(await screen.findByRole("button", { name: /ticket booking paused/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /ticket booking paused/i }));
    expect(screen.getByTestId("where")).toHaveTextContent("/discover");
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("an event whose tickets are sold elsewhere opens that link, with no guest-list row", async () => {
    inRouter(<SessionCard session={{ ...base, is_ticketed: false, external_ticket_url: "https://tickets.example/1" } as any} />);
    join();
    await waitFor(() => expect(window.open).toHaveBeenCalledWith("https://tickets.example/1", "_blank", "noopener,noreferrer"));
    expect(mocks.inserts).toHaveLength(0);
  });

  it("a free event uses the authenticated capacity-checking RSVP RPC", async () => {
    inRouter(<SessionCard session={{ ...base, is_ticketed: false } as any} />);
    join();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("rsvp_to_event", { p_event_id: "ev1" }));
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.invoke).not.toHaveBeenCalled();
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

  it("a single-price native ticket is unavailable until capacity and payment confirmation are atomic", async () => {
    mocks.invoke.mockResolvedValue({ data: { url: "https://checkout.example/s" }, error: null });
    open({ is_ticketed: true, ticket_price: 25, ticket_currency: "USD" });
    const ticketButtons = await screen.findAllByRole("button", { name: /Ticket booking paused/i });
    expect(ticketButtons.length).toBeGreaterThan(0);
    ticketButtons.forEach((button) => expect(button).toBeDisabled());
    fireEvent.click(ticketButtons[0]);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.inserts).toHaveLength(0);
  });

  it("a free event uses the authenticated capacity-checking RSVP RPC, not a client insert", async () => {
    open({ is_ticketed: false });
    fireEvent.click(await screen.findByRole("button", { name: /Join Event/ }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("rsvp_to_event", { p_event_id: "ev1" }));
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("ignores duplicate clicks while the server is resolving the booking", async () => {
    mocks.rpc.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: "joined", error: null }), 30)));
    open({ is_ticketed: false });
    const joinButton = await screen.findByRole("button", { name: /Join Event/ });
    fireEvent.click(joinButton);
    fireEvent.click(joinButton);

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  });

  it("does not confirm a seat when the server rejects a competing RSVP at capacity", async () => {
    mocks.rpc.mockResolvedValue({ data: "full_no_waitlist", error: null });
    open({ is_ticketed: false, max_participants: 2, participant_count: 1 });
    fireEvent.click(await screen.findByRole("button", { name: /Join Event/ }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("rsvp_to_event", { p_event_id: "ev1" }));
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalled();
  });
});

describe("leaving an event against a database that has not got cancel_event_rsvp (production, 2026-11-10)", () => {
  // What production's API answered for that function: HTTP 404, PGRST202. It exists only in migration 20261109130000, which production has not got.
  const CANCEL_MISSING = { code: "PGRST202", message: "Could not find the function public.cancel_event_rsvp(p_event_id) in the schema cache" };

  beforeEach(() => {
    mocks.participation = "going";
    mocks.rpc.mockImplementation(async (name: string) => (name === "cancel_event_rsvp" ? { data: null, error: CANCEL_MISSING } : { data: "joined", error: null }));
  });

  it("a member can still leave from the event card: their own row is set to cancelled, and the card says they left", async () => {
    inRouter(<SessionCard session={{ ...base, is_ticketed: false } as any} userParticipation="going" />);
    fireEvent.click(await screen.findByRole("button", { name: /Going/ }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: "Left event" }));
    expect(mocks.updates).toEqual([{ table: "jam_participants", payload: { status: "cancelled" } }]);
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("and from the event's detail dialog, which then refreshes the list", async () => {
    const onRefresh = vi.fn();
    inRouter(<SessionDetailDialog session={{ ...base, is_ticketed: false } as any} open onOpenChange={() => {}} onRefresh={onRefresh} />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Going/ }))[0]);

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: "Left event" }));
    expect(mocks.updates).toEqual([{ table: "jam_participants", payload: { status: "cancelled" } }]);
    expect(onRefresh).toHaveBeenCalled();
  });

  it("uses the cancel function when the database has it, and writes no row itself", async () => {
    mocks.rpc.mockResolvedValue({ data: "cancelled", error: null });
    inRouter(<SessionCard session={{ ...base, is_ticketed: false } as any} userParticipation="going" />);
    fireEvent.click(await screen.findByRole("button", { name: /Going/ }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: "Left event" }));
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_event_rsvp", { p_event_id: "ev1" });
    expect(mocks.updates).toEqual([]);
  });
});
