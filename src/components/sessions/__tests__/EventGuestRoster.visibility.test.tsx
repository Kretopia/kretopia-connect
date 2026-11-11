import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The crew list of an Event page follows the same rule as the participants modal: guests are listed, members who hid themselves are not. */
const db = vi.hoisted(() => ({
  participants: [] as Record<string, unknown>[],
  profiles: [] as Record<string, unknown>[],
  filters: [] as { table: string; op: string; args: unknown[] }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (...args: unknown[]) => { db.filters.push({ table, op: "eq", args }); return chain; },
        in: (...args: unknown[]) => { db.filters.push({ table, op: "in", args }); return chain; },
        or: (...args: unknown[]) => { db.filters.push({ table, op: "or", args }); return chain; },
        update: () => chain,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: table === "jam_participants" ? db.participants : table === "public_profiles_safe" ? db.profiles : [], error: null }).then(resolve, reject),
      };
      return chain;
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { EventGuestRoster } from "../EventGuestRoster";

const draw = (props: Partial<React.ComponentProps<typeof EventGuestRoster>> = {}) =>
  render(
    <MemoryRouter>
      <EventGuestRoster eventId="e1" eventTitle="Studio Night" hostId="host" currentUserId={null} isParticipant={false} isHost={false} {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  db.filters.length = 0;
  db.participants = [
    { id: "1", user_id: "u1", guest_name: null, joined_at: "2026-11-01T10:00:00Z", is_visible: true },
    { id: "2", user_id: "u2", guest_name: null, joined_at: "2026-11-02T10:00:00Z", is_visible: false },
    { id: "3", user_id: null, guest_name: "Cleo Guest", joined_at: "2026-11-03T10:00:00Z", is_visible: true },
  ];
  db.profiles = [
    { user_id: "host", full_name: "Ada Host", username: "ada", avatar_url: null, role: "Producer", bio: null, location: null },
    { user_id: "u1", full_name: "Ari Stone", username: "ari", avatar_url: null, role: "Producer", bio: null, location: null },
    { user_id: "u2", full_name: "Hid Den", username: "hid", avatar_url: null, role: "Editor", bio: null, location: null },
  ];
});

describe("EventGuestRoster: who a viewer may see", () => {
  it("lists members and guest RSVPs, and leaves out a member who hid themselves, for a visitor", async () => {
    draw();
    expect(await screen.findByText("Ari Stone")).toBeInTheDocument();
    expect(screen.getByText("Cleo Guest")).toBeInTheDocument();
    expect(screen.queryByText("Hid Den")).not.toBeInTheDocument();
    // The server is asked for visible rows only.
    expect(db.filters.filter((f) => f.table === "jam_participants" && f.op === "or").map((f) => f.args[0])).toEqual(["is_visible.is.null,is_visible.eq.true"]);
  });

  it("shows the host everyone, and asks the server for every row", async () => {
    draw({ isHost: true, currentUserId: "host" });
    expect(await screen.findByText("Hid Den")).toBeInTheDocument();
    expect(screen.getByText("Ari Stone")).toBeInTheDocument();
    expect(screen.getByText("Cleo Guest")).toBeInTheDocument();
    await waitFor(() => expect(db.filters.some((f) => f.table === "jam_participants")).toBe(true));
    expect(db.filters.filter((f) => f.table === "jam_participants" && f.op === "or")).toEqual([]);
  });
});
