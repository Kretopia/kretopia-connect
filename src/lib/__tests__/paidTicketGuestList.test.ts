import { describe, expect, it, vi } from "vitest";
import { ensurePaidBuyerOnGuestList } from "../paidTicketGuestList";

/** A paid buyer the backend failed to add (it writes a status the table rejects) is added through rsvp_to_event, once. */
const client = (row: { status: string } | null, rpc: { data?: unknown; error?: unknown } = { data: "joined" }) => {
  const calls: unknown[] = [];
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "eq"]) chain[k] = () => chain;
  chain.maybeSingle = async () => ({ data: row, error: null });
  const c = { from: () => chain, rpc: vi.fn(async (...a: unknown[]) => { calls.push(a); return { data: rpc.data ?? null, error: rpc.error ?? null }; }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c as any;
};

describe("ensurePaidBuyerOnGuestList", () => {
  it("does nothing when the buyer is already on the list (the backend worked)", async () => {
    const c = client({ status: "going" });
    expect(await ensurePaidBuyerOnGuestList(c, "e1", "u1")).toBe("present");
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it("adds a missing buyer through rsvp_to_event, for that event", async () => {
    const c = client(null);
    expect(await ensurePaidBuyerOnGuestList(c, "e1", "u1")).toBe("added");
    expect(c.rpc).toHaveBeenCalledWith("rsvp_to_event", { p_event_id: "e1" });
  });

  it("re-adds a buyer whose earlier answer was cancelled", async () => {
    expect(await ensurePaidBuyerOnGuestList(client({ status: "cancelled" }), "e1", "u1")).toBe("added");
  });

  it("says so when the event is full, or when the call fails", async () => {
    expect(await ensurePaidBuyerOnGuestList(client(null, { data: "waitlisted" }), "e1", "u1")).toBe("waitlisted");
    expect(await ensurePaidBuyerOnGuestList(client(null, { error: { message: "denied" } }), "e1", "u1")).toBe("failed");
    expect(await ensurePaidBuyerOnGuestList(client(null, { data: "full_no_waitlist" }), "e1", "u1")).toBe("failed");
  });
});
