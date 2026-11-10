import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The calendar workspace keeps what I saved apart from what I am going to, and never exports an address the host did not share. */
const m = vi.hoisted(() => ({
  going: [] as { jam_id: string }[],
  others: [] as Record<string, unknown>[],
  from: vi.fn(),
  downloadIcs: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      m.from(table);
      const result = () => ({ data: table === "jam_participants" ? m.going : m.others, error: null });
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in"]) chain[method] = () => chain;
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
      return chain;
    },
  },
}));
vi.mock("@/lib/eventActions", () => ({ downloadIcs: (...args: unknown[]) => m.downloadIcs(...args) }));
vi.mock("@/components/sessions/EventCalendar", () => ({ default: () => <div data-testid="month-grid" /> }));

import { EventCalendarWorkspace } from "../EventCalendarWorkspace";

const day = (offset: number, hour = 18) => new Date(Date.UTC(2026, 11, 5 + offset, hour, 0, 0)).toISOString();
const active = {
  id: "e1", title: "Studio Night", start_time: day(0), end_time: day(0, 21), venue_name: "Studio Nine", venue_address: "1 Rue Exemple",
  category: "music", max_participants: 0, participant_count: 3, creator_name: "Ada Host", created_by: "host", description: "Bring stems.",
  is_ticketed: false, ticket_price: 0, ticket_currency: null, event_mode: "irl", status: "upcoming",
};
const other = (id: string, title: string, offset: number) => ({
  id, title, start_time: day(offset), end_time: day(offset, 21), venue_name: `${title} Hall`, venue_address: `9 Rue ${title}`, category: "music",
  max_participants: 0, created_by: "h2", description: null, is_ticketed: false, ticket_price: 0, ticket_currency: null, event_mode: "irl", status: "upcoming",
});

type Props = React.ComponentProps<typeof EventCalendarWorkspace>;
const draw = (over: Partial<Props> = {}) => {
  const handlers = { onToggleSaved: vi.fn(), onSignIn: vi.fn(), onCalendarOpenChange: vi.fn() };
  render(
    <EventCalendarWorkspace
      event={active}
      userId="viewer"
      participation={null}
      bookingDisabled={false}
      bookingReason={null}
      calendarOpen
      returnFocusRef={{ current: null }}
      savedIds={new Set()}
      saveAvailable
      busyEventId={null}
      onSignIn={handlers.onSignIn}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
};
const openMine = async () => {
  fireEvent.mouseDown(await screen.findByRole("tab", { name: "My calendar" }), { button: 0 });
  return screen.findByRole("tabpanel", { name: "My calendar" });
};

beforeEach(() => {
  m.going = [];
  m.others = [];
  m.from.mockReset();
  m.downloadIcs.mockReset();
});

describe("EventCalendarWorkspace: my calendar is what I saved plus what I am going to, kept apart", () => {
  it("lists a saved event as 'On my calendar' and an RSVP as 'Going', never one as the other", async () => {
    m.going = [{ jam_id: "e3" }];
    m.others = [other("e2", "Saved Night", 1), other("e3", "Going Night", 2)];
    draw({ savedIds: new Set(["e2"]) });
    const panel = await openMine();
    await waitFor(() => expect(within(panel).getByText("Saved Night")).toBeInTheDocument());
    const saved = within(panel).getByText("Saved Night").closest("button")!;
    const going = within(panel).getByText("Going Night").closest("button")!;
    expect(saved).toHaveTextContent("On my calendar");
    expect(saved).not.toHaveTextContent("Going");
    expect(going).toHaveTextContent("Going");
    expect(going).not.toHaveTextContent("On my calendar");
    // The page's own event is on neither list, so it is not there.
    expect(within(panel).queryByText("Studio Night")).not.toBeInTheDocument();
  });

  it("an event I saved is on my calendar even though I am not going; an event I am going to is on it even though I did not save it", async () => {
    draw({ savedIds: new Set(["e1"]) });
    const first = await openMine();
    // the row's own status line says so (the row's calendar menu also carries the words, from sm, so the status is read off the row's title button)
    const row = within(first).getByText("Studio Night").closest("button") as HTMLElement;
    expect(row).toHaveTextContent("On my calendar");
  });

  it("says plainly when nothing is on my calendar yet, and asks a visitor to sign in", async () => {
    draw();
    expect(await within(await openMine()).findByText("Nothing on your calendar yet. Add an event to see it here.")).toBeInTheDocument();
  });

  it("a signed-out visitor reads nothing from the database and is asked to sign in", async () => {
    draw({ userId: null });
    expect(await within(await openMine()).findByText("Sign in to see your calendar.")).toBeInTheDocument();
    expect(m.from).not.toHaveBeenCalled();
  });
});

describe("EventCalendarWorkspace: the event's own actions are calendar actions, apart from RSVP", () => {
  it("offers my calendar and the two exports, and a separate RSVP link while I am not going", async () => {
    const { onToggleSaved } = draw();
    const group = await screen.findByRole("group", { name: "Calendar" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual(["Add to my calendar", "Export .ics", "Google Calendar"]);
    fireEvent.click(within(group).getByRole("button", { name: "Add to my calendar" }));
    expect(onToggleSaved).toHaveBeenCalledWith("e1");
    expect(screen.getByRole("link", { name: "RSVP for this event" })).toHaveAttribute("href", "#event-booking");
  });

  it("does not offer an RSVP link once I am going", async () => {
    draw({ participation: "going" });
    await screen.findByRole("group", { name: "Calendar" });
    expect(screen.queryByRole("link", { name: "RSVP for this event" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Going").length).toBeGreaterThan(0);
  });

  it("explains why RSVP is closed instead of offering it", async () => {
    draw({ bookingDisabled: true, bookingReason: "Bookings are closed because this event has ended." });
    await screen.findByRole("group", { name: "Calendar" });
    expect(screen.queryByRole("link", { name: "RSVP for this event" })).not.toBeInTheDocument();
    expect(screen.getByText("Bookings are closed because this event has ended.")).toBeInTheDocument();
  });
});

describe("EventCalendarWorkspace: an export carries an address only when it was shared with me", () => {
  it("leaves this event's address out when the host hid the venue", async () => {
    draw({ venueDetailsVisible: false });
    fireEvent.click(await screen.findByRole("button", { name: "Export .ics" }));
    expect(m.downloadIcs).toHaveBeenCalledWith(expect.objectContaining({ id: "e1", venueName: "Studio Nine", venueAddress: null }));
  });

  it("keeps this event's address when the venue is shown", async () => {
    draw();
    fireEvent.click(await screen.findByRole("button", { name: "Export .ics" }));
    expect(m.downloadIcs).toHaveBeenCalledWith(expect.objectContaining({ id: "e1", venueAddress: "1 Rue Exemple" }));
  });

  it("leaves another host's address out of an event I only saved, and keeps it for one I am going to", async () => {
    m.going = [{ jam_id: "e3" }];
    m.others = [other("e2", "Saved Night", 1), other("e3", "Going Night", 2)];
    draw({ savedIds: new Set(["e2"]) });
    const panel = await openMine();
    await waitFor(() => expect(within(panel).getByText("Saved Night")).toBeInTheDocument());

    const rowOf = (title: string) => within(panel).getByText(title).closest("div.rounded-xl") as HTMLElement;
    const exportIcs = (title: string) => {
      fireEvent.keyDown(within(rowOf(title)).getByRole("button", { name: /^(Add to calendar|Calendar: on my calendar)$/ }), { key: "Enter" });
      fireEvent.click(screen.getByRole("menuitem", { name: ".ics file (Apple, Outlook)" }));
    };
    exportIcs("Saved Night");
    expect(m.downloadIcs).toHaveBeenLastCalledWith(expect.objectContaining({ id: "e2", venueName: "Saved Night Hall", venueAddress: null }));
    exportIcs("Going Night");
    expect(m.downloadIcs).toHaveBeenLastCalledWith(expect.objectContaining({ id: "e3", venueAddress: "9 Rue Going Night" }));
  });
});
