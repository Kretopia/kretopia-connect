import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  toast: vi.fn(),
  openChange: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpc(...args),
    functions: { invoke: (...args: unknown[]) => mocks.invoke(...args) },
    from: () => {
      const chain: MockQuery = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        limit: () => chain,
        order: () => chain,
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return chain;
    },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { GuestRsvpDialog } from "../GuestRsvpDialog";

type MockQuery = {
  select: () => MockQuery;
  eq: () => MockQuery;
  ilike: () => MockQuery;
  limit: () => MockQuery;
  order: () => MockQuery;
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise<unknown>;
};

describe("GuestRsvpDialog duplicate reservation", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ data: { status: "already" }, error: null });
    mocks.invoke.mockReset();
    mocks.toast.mockReset();
    mocks.openChange.mockReset();
    mocks.complete.mockReset();
  });

  it("does not re-confirm or notify for an existing guest booking", async () => {
    render(
      <MemoryRouter>
        <GuestRsvpDialog
          open
          onOpenChange={mocks.openChange}
          eventId="event-1"
          eventTitle="Studio Night"
          onRsvpComplete={mocks.complete}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ari" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ari@example.com" } });
    fireEvent.change(screen.getByLabelText("Confirm email"), { target: { value: "ari@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /reserve|rsvp/i }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("reserve_event_guest_rsvp", {
      p_event_id: "event-1",
      p_guest_name: "Ari",
      p_guest_email: "ari@example.com",
    }));
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.openChange).toHaveBeenCalledWith(false);
  });
});

/**
 * What production's API answered on 2026-11-10 when asked for reserve_event_guest_rsvp: HTTP 404, PGRST202. The function exists only in
 * migration 20261109130000, which production's database (the legacy backend, which this repository's migrations never reach) does not have.
 * Every guest RSVP therefore failed with "Couldn't RSVP". guest_rsvp_upsert, the function the dialog used before, is there.
 */
const MISSING_RESERVE = {
  code: "PGRST202",
  details: "Searched for the function public.reserve_event_guest_rsvp with parameters p_event_id, p_guest_email, p_guest_name or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
  hint: null,
  message: "Could not find the function public.reserve_event_guest_rsvp(p_event_id, p_guest_email, p_guest_name) in the schema cache",
};

const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
};

const guestRsvp = () => {
  render(
    <MemoryRouter initialEntries={["/event/event-1"]}>
      <GuestRsvpDialog open onOpenChange={mocks.openChange} eventId="event-1" eventTitle="Studio Night" onRsvpComplete={mocks.complete} />
      <Where />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ari" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ari@example.com" } });
  fireEvent.change(screen.getByLabelText("Confirm email"), { target: { value: "ari@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: /reserve|rsvp/i }));
};

describe("GuestRsvpDialog against a database that has not got the newer reservation function (production)", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.invoke.mockReset().mockResolvedValue({ data: null, error: null });
    mocks.toast.mockReset();
    mocks.openChange.mockReset();
    mocks.complete.mockReset();
  });

  it("still books the guest, through the function the database has, instead of failing with \"Couldn't RSVP\"", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "reserve_event_guest_rsvp"
        ? { data: null, error: MISSING_RESERVE }
        : { data: [{ check_in_token: "pass-token-1", status: "going" }], error: null },
    );
    guestRsvp();

    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["reserve_event_guest_rsvp", "guest_rsvp_upsert"]);
    expect(mocks.rpc).toHaveBeenLastCalledWith("guest_rsvp_upsert", { p_event_id: "event-1", p_guest_name: "Ari", p_guest_email: "ari@example.com" });
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't RSVP" }));
    // The guest lands on the event page with the confirmation and the pass the database returned.
    const where = screen.getByTestId("where").textContent ?? "";
    expect(where).toContain("/event/event-1?");
    expect(where).toContain("rsvp=confirmed");
    expect(where).toContain("token=pass-token-1");
    // ...and the confirmation email carries that pass.
    expect(mocks.invoke).toHaveBeenCalledWith("send-transactional-email", expect.objectContaining({
      body: expect.objectContaining({
        recipientEmail: "ari@example.com",
        templateData: expect.objectContaining({ attendeeName: "Ari", checkInToken: "pass-token-1", isGuest: true }),
      }),
    }));
    // One confirmation email per RSVP, and its links are on the public site (an email is opened outside the app).
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    const { templateData } = (mocks.invoke.mock.calls[0][1] as { body: { templateData: Record<string, string> } }).body;
    expect(templateData.eventUrl).toBe("https://www.kretopia.com/event/event-1");
    expect(templateData.passUrl).toBe("https://www.kretopia.com/event/event-1/pass?token=pass-token-1&name=Ari");
  });

  it("uses the newer function when the database has it, and never calls the older one", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ check_in_token: "pass-token-2", status: "going" }], error: null });
    guestRsvp();

    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["reserve_event_guest_rsvp"]);
  });

  it("does not hide a real refusal behind the older function: a cancelled event stays refused, and says so", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Event cancelled" } });
    guestRsvp();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't RSVP", description: "Event cancelled", variant: "destructive" })));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("when neither function can be reached, says so and leaves the form usable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: MISSING_RESERVE });
    guestRsvp();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't RSVP", variant: "destructive" })));
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /reserve|rsvp/i })).toBeEnabled();
  });
});
