import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The event RSVP calls that fall back to their older twin. Only the database is stood in for. The error objects below are what production's
 * API actually answered on 2026-11-10 (HTTP 404, PGRST202) when asked for the two functions of migration 20261109130000, which its
 * database does not have.
 */
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  writes: [] as { table: string; payload: unknown; filters: Array<[string, unknown]> }[],
  writeError: null as unknown,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => m.rpc(...args),
    from: (table: string) => {
      const write = { table, payload: undefined as unknown, filters: [] as Array<[string, unknown]> };
      const chain: Record<string, unknown> = {
        update: (payload: unknown) => { write.payload = payload; return chain; },
        eq: (column: string, value: unknown) => { write.filters.push([column, value]); return chain; },
        then: (resolve: (value: unknown) => unknown) => {
          m.writes.push(write);
          return Promise.resolve({ data: null, error: m.writeError }).then(resolve);
        },
      };
      return chain;
    },
  },
}));

import { cancelEventRsvp, isMissingFunction, reserveGuestRsvp } from "../eventRsvp";

const missing = (name: string, args: string) => ({
  code: "PGRST202",
  details: `Searched for the function public.${name} with parameter p_event_id or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`,
  hint: null,
  message: `Could not find the function public.${name}(${args}) in the schema cache`,
});
const RESERVE_MISSING = missing("reserve_event_guest_rsvp", "p_event_id, p_guest_email, p_guest_name");
const CANCEL_MISSING = missing("cancel_event_rsvp", "p_event_id");

const guest = { eventId: "event-1", name: "Ari", email: "ari@example.com" };
const guestArgs = { p_event_id: "event-1", p_guest_name: "Ari", p_guest_email: "ari@example.com" };

beforeEach(() => {
  m.rpc.mockReset();
  m.writes.length = 0;
  m.writeError = null;
});

describe("isMissingFunction", () => {
  it("is true for what production answered: PGRST202", () => {
    expect(isMissingFunction(RESERVE_MISSING, "reserve_event_guest_rsvp")).toBe(true);
    expect(isMissingFunction(CANCEL_MISSING, "cancel_event_rsvp")).toBe(true);
  });

  it("is true for Postgres's own 'does not exist' when it names the function that was called", () => {
    expect(isMissingFunction({ code: "42883", message: "function public.cancel_event_rsvp(uuid) does not exist" }, "cancel_event_rsvp")).toBe(true);
  });

  it("is false for a missing helper inside a function that exists, and for every ordinary refusal", () => {
    expect(isMissingFunction({ code: "42883", message: "function public.some_helper(uuid) does not exist" }, "cancel_event_rsvp")).toBe(false);
    expect(isMissingFunction({ code: "22023", message: "Event cancelled" }, "reserve_event_guest_rsvp")).toBe(false);
    expect(isMissingFunction({ code: "P0001", message: "auth_required" }, "cancel_event_rsvp")).toBe(false);
    expect(isMissingFunction({ code: "42501", message: "Event not open to guests" }, "reserve_event_guest_rsvp")).toBe(false);
  });

  it("is false for a missing table (another migration) and for no error at all", () => {
    expect(isMissingFunction({ code: "PGRST205", message: "Could not find the table 'public.event_page_sections' in the schema cache" }, "cancel_event_rsvp")).toBe(false);
    expect(isMissingFunction(null, "cancel_event_rsvp")).toBe(false);
    expect(isMissingFunction(undefined, "cancel_event_rsvp")).toBe(false);
  });
});

describe("reserveGuestRsvp", () => {
  it("uses the newer function when the database has it, and only that one", async () => {
    m.rpc.mockResolvedValue({ data: [{ check_in_token: "tok", status: "going" }], error: null });
    await expect(reserveGuestRsvp(guest)).resolves.toEqual({ check_in_token: "tok", status: "going" });
    expect(m.rpc.mock.calls).toEqual([["reserve_event_guest_rsvp", guestArgs]]);
  });

  it("falls back to the older function, with the same arguments, when the database has not got the newer one", async () => {
    m.rpc.mockImplementation(async (name: string) =>
      name === "reserve_event_guest_rsvp" ? { data: null, error: RESERVE_MISSING } : { data: [{ check_in_token: "legacy-tok", status: "going" }], error: null });
    await expect(reserveGuestRsvp(guest)).resolves.toEqual({ check_in_token: "legacy-tok", status: "going" });
    expect(m.rpc.mock.calls).toEqual([["reserve_event_guest_rsvp", guestArgs], ["guest_rsvp_upsert", guestArgs]]);
  });

  it("reads a single row as well as a list", async () => {
    m.rpc.mockResolvedValue({ data: { check_in_token: null, status: "already" }, error: null });
    await expect(reserveGuestRsvp(guest)).resolves.toEqual({ check_in_token: null, status: "already" });
  });

  it("does not retry a refusal on the older path: the newer function answered", async () => {
    const refusal = { code: "22023", message: "Event cancelled" };
    m.rpc.mockResolvedValue({ data: null, error: refusal });
    await expect(reserveGuestRsvp(guest)).rejects.toBe(refusal);
    expect(m.rpc).toHaveBeenCalledTimes(1);
  });

  it("reports the older function's own failure when it fails too", async () => {
    const failure = { code: "22023", message: "Invalid email" };
    m.rpc.mockImplementation(async (name: string) => (name === "reserve_event_guest_rsvp" ? { data: null, error: RESERVE_MISSING } : { data: null, error: failure }));
    await expect(reserveGuestRsvp(guest)).rejects.toBe(failure);
    expect(m.rpc).toHaveBeenCalledTimes(2);
  });

  it("returns null when the database answers with nothing, so that the caller can say the RSVP failed", async () => {
    m.rpc.mockResolvedValue({ data: [], error: null });
    await expect(reserveGuestRsvp(guest)).resolves.toBeNull();
    m.rpc.mockResolvedValue({ data: null, error: null });
    await expect(reserveGuestRsvp(guest)).resolves.toBeNull();
  });
});

describe("cancelEventRsvp", () => {
  it("uses the cancel function when the database has it, writes nothing itself, and passes on what it said", async () => {
    m.rpc.mockResolvedValue({ data: "cancelled", error: null });
    await expect(cancelEventRsvp("event-1", "member-1")).resolves.toBe("cancelled");
    m.rpc.mockResolvedValue({ data: "not_going", error: null });
    await expect(cancelEventRsvp("event-1", "member-1")).resolves.toBe("not_going");
    expect(m.rpc.mock.calls).toEqual([["cancel_event_rsvp", { p_event_id: "event-1" }], ["cancel_event_rsvp", { p_event_id: "event-1" }]]);
    expect(m.writes).toEqual([]);
  });

  it("when the database has not got it, sets the member's own participation row to cancelled, as it was done before", async () => {
    m.rpc.mockResolvedValue({ data: null, error: CANCEL_MISSING });
    await expect(cancelEventRsvp("event-1", "member-1")).resolves.toBe("cancelled");
    expect(m.writes).toEqual([{ table: "jam_participants", payload: { status: "cancelled" }, filters: [["jam_id", "event-1"], ["user_id", "member-1"]] }]);
  });

  it("does not fall back on a real refusal, and writes nothing", async () => {
    const refusal = { code: "P0001", message: "auth_required" };
    m.rpc.mockResolvedValue({ data: null, error: refusal });
    await expect(cancelEventRsvp("event-1", "member-1")).rejects.toBe(refusal);
    expect(m.writes).toEqual([]);
  });

  it("reports the failure of the direct update instead of saying it was cancelled", async () => {
    const failure = { code: "42501", message: "new row violates row-level security policy" };
    m.rpc.mockResolvedValue({ data: null, error: CANCEL_MISSING });
    m.writeError = failure;
    await expect(cancelEventRsvp("event-1", "member-1")).rejects.toBe(failure);
  });
});
