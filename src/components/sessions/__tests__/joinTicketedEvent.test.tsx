import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inserts: [] as unknown[],
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

  it("does not confirm a seat when the server rejects a competing RSVP at capacity", async () => {
    mocks.rpc.mockResolvedValue({ data: "full_no_waitlist", error: null });
    open({ is_ticketed: false, max_participants: 1, participant_count: 1 });
    fireEvent.click(await screen.findByRole("button", { name: /Join Event/ }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("rsvp_to_event", { p_event_id: "ev1" }));
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalled();
  });
});
