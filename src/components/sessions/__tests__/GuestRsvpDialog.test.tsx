import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
