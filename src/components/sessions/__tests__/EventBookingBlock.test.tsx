import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  openDirections: vi.fn(),
  participants: [] as Record<string, unknown>[],
  profiles: [] as Record<string, unknown>[],
  reads: [] as string[],
}));

vi.mock("@/lib/eventActions", () => ({ openDirections: (...args: unknown[]) => m.openDirections(...args) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      m.reads.push(table);
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        or: () => chain,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: table === "jam_participants" ? m.participants : m.profiles, error: null }).then(resolve, reject),
      };
      return chain;
    },
  },
}));

import { EventBookingBlock } from "../EventBookingBlock";
import { getEventBookingControl, getEventBookingReason, getEventBookingState } from "@/lib/eventBookingState";
import { formatEventTime } from "@/lib/eventTime";

const START = new Date(Date.now() + 30 * 86_400_000).toISOString();
const availableInput = {
  loading: false, availabilityReady: true, cancelled: false, ended: false, hosting: false, participation: null as string | null,
  full: false, waitlistEnabled: false, authenticated: true, nativePaid: false,
};
const controlFor = (input: Partial<typeof availableInput> = {}) => getEventBookingControl(getEventBookingState({ ...availableInput, ...input }));

const props = (over: Partial<Parameters<typeof EventBookingBlock>[0]> = {}): Parameters<typeof EventBookingBlock>[0] => ({
  eventId: "e1", eventTitle: "Studio Night", startTime: START,
  countdown: { days: 29, hours: 23, minutes: 59, ended: false },
  isPast: false, isCancelled: false, isCompleted: false, isOnline: false, onlineFormat: null,
  venueName: "Studio Nine", venueAddress: "1 Rue Exemple, Paris", venueDetailsVisible: true,
  isAuthenticated: true, isHost: false, viewerId: "viewer", priceLabel: null, ticketUrl: null, capacity: 0, participantCount: 3,
  attendees: [{ id: "u1", name: "Ari" }, { id: "u2", name: "Bea" }, { id: "u3", name: "Cam" }], attendeesVisible: true,
  control: controlFor(), reason: null, joining: false, rsvpNotice: null, onDismissNotice: vi.fn(), onBook: vi.fn(), onCancelRsvp: vi.fn(),
  calendarAction: <button type="button">Add to calendar</button>,
  host: { full_name: "Ada Host", id_verified: true, hostedCount: 2 }, onContactHost: vi.fn(), policiesVisible: true, onSignIn: vi.fn(), bottomNav: true,
  ...over,
});

const draw = (over: Partial<Parameters<typeof EventBookingBlock>[0]> = {}) => {
  const p = props(over);
  const view = render(
    <MemoryRouter initialEntries={["/event/e1"]}>
      <Routes>
        <Route path="/event/:eventId" element={<EventBookingBlock {...p} />} />
        <Route path="/epk/:userId" element={<p>Public Passport page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  const again = (next: Partial<Parameters<typeof EventBookingBlock>[0]>) => view.rerender(
    <MemoryRouter initialEntries={["/event/e1"]}>
      <Routes>
        <Route path="/event/:eventId" element={<EventBookingBlock {...props({ ...over, ...next })} />} />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, p, again };
};

const text = () => document.body.textContent ?? "";
const count = (needle: string | RegExp) => (typeof needle === "string" ? text().split(needle).length - 1 : (text().match(new RegExp(needle, "g")) ?? []).length);
const primary = () => document.querySelectorAll('[data-booking-cta="primary"]');
const section = (name: string) => document.querySelector<HTMLElement>(`[data-booking-section="${name}"]`);

beforeEach(() => { m.openDirections.mockReset(); m.participants = []; m.profiles = []; m.reads.length = 0; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("EventBookingBlock: each fact once, in one block", () => {
  it("states the price, the date, the places and the count one time each", () => {
    draw({ priceLabel: "€20", capacity: 20, participantCount: 12, control: controlFor() });

    expect(count("€20")).toBe(1);
    expect(count(formatEventTime(START))).toBe(1);
    expect(count("8 places left")).toBe(1);
    expect(count(/12 going/)).toBe(1);
    // "Free" is not said alongside a price, and the old blocks' words are gone.
    expect(count("Free")).toBe(0);
    expect(text()).not.toMatch(/Admission|Event options|going · \d+ places/);
  });

  it("says Free once for a free event, and no places line when there is no limit", () => {
    draw({ priceLabel: null, capacity: 0 });
    expect(count("Free")).toBe(1);
    expect(text()).not.toMatch(/places? left/);
  });

  it("draws the sections in the required order: when and where, price and control, two secondary rows, host, who is going", () => {
    draw();
    const names = ["status", "admission", "secondary", "host", "participants"];
    const nodes = names.map((name) => section(name));
    expect(nodes.every(Boolean)).toBe(true);
    for (let index = 0; index < nodes.length - 1; index += 1) {
      expect(nodes[index]!.compareDocumentPosition(nodes[index + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // …and the policies link closes the block.
    const policies = screen.getByRole("link", { name: "Event policies" });
    expect(section("participants")!.compareDocumentPosition(policies) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has exactly two secondary rows: Add to calendar and Open map", () => {
    draw();
    const rows = section("secondary")!;
    expect(within(rows).getAllByRole("button").map((button) => button.textContent?.trim())).toEqual(["Add to calendar", "Open map"]);
  });

  it("links to the policies instead of making them a row, and only while the Policies section exists", () => {
    const { unmount } = draw();
    expect(screen.getByRole("link", { name: "Event policies" })).toHaveAttribute("href", "#about-policies");
    unmount();
    draw({ policiesVisible: false });
    expect(screen.queryByRole("link", { name: "Event policies" })).not.toBeInTheDocument();
  });

  it("is one landmark with no nested bordered card inside it", () => {
    draw({ rsvpNotice: { tone: "success", text: "You're going." } });
    const block = screen.getByRole("region", { name: "Event booking" });
    expect(block.querySelectorAll('[class~="rounded-2xl"], [class~="rounded-xl"], [class~="rounded-lg"]:not(button):not(a)')).toHaveLength(0);
    expect(block.querySelectorAll('[class*="bg-card"]')).toHaveLength(0);
  });
});

describe("EventBookingBlock: when and where", () => {
  it("shows the countdown, then the local date and time with its zone, then the venue label", () => {
    draw();
    const timer = screen.getByRole("timer");
    expect(timer).toHaveTextContent("Starts in");
    expect(timer).toHaveTextContent("29 days · 23 hours · 59 mins");
    expect(timer).toHaveAccessibleName("29 days, 23 hours, and 59 minutes until the event");
    const status = section("status")!;
    expect(status).toHaveTextContent(`${formatEventTime(START)} · UTC`);
    expect(status).toHaveTextContent("Studio Nine");
    expect(status.querySelector("[title^='Event time zone:']")).not.toBeNull();
  });

  it("says Happening now once it started, and nothing once it is over", () => {
    const { unmount } = draw({ countdown: { days: 0, hours: 0, minutes: 0, ended: true } });
    expect(screen.getByText("Happening now")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    unmount();
    draw({ countdown: { days: 0, hours: 0, minutes: 0, ended: true }, isPast: true, control: controlFor({ ended: true }) });
    expect(screen.queryByText("Happening now")).not.toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("labels an online event as online, with no map", () => {
    draw({ isOnline: true, onlineFormat: "Live stream", venueName: null, venueAddress: null });
    expect(section("status")).toHaveTextContent("Online event · Live stream");
    expect(screen.queryByRole("button", { name: /map/i })).not.toBeInTheDocument();
  });

  it("opens the map for a signed-in member, and sends a visitor to sign in first", () => {
    const { p, unmount } = draw();
    fireEvent.click(screen.getByRole("button", { name: "Open map" }));
    expect(m.openDirections).toHaveBeenCalledWith("1 Rue Exemple, Paris", "Studio Nine");
    unmount();

    const visitor = draw({ isAuthenticated: false });
    expect(section("status")).toHaveTextContent("Studio Nine");
    fireEvent.click(screen.getByRole("button", { name: "Sign in to open the map" }));
    expect(visitor.p.onSignIn).toHaveBeenCalledOnce();
    expect(m.openDirections).toHaveBeenCalledOnce();
    expect(p).toBeDefined();
  });

  it("keeps the address and the map off a visitor's page when the host hid the venue, but keeps the venue's name", () => {
    draw({ isAuthenticated: false, venueAddress: null, venueDetailsVisible: false });
    expect(text()).not.toContain("1 Rue Exemple");
    expect(screen.queryByRole("button", { name: /map/i })).not.toBeInTheDocument();
    expect(section("status")).toHaveTextContent("Studio Nine");
  });

  it("leaves out the calendar and the map once the event is over or cancelled", () => {
    draw({ isPast: true, control: controlFor({ ended: true }) });
    expect(section("secondary")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to calendar" })).not.toBeInTheDocument();
  });
});

describe("EventBookingBlock: one primary action, and its state machine", () => {
  it("draws I'm Going as the page's single primary button, and presses it once", () => {
    const { p } = draw();
    expect(primary()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "I'm Going" }));
    expect(p.onBook).toHaveBeenCalledOnce();
  });

  const cases: { name: string; input: Partial<typeof availableInput>; label: string; primary: boolean; cancel?: string }[] = [
    { name: "free place", input: {}, label: "I'm Going", primary: true },
    { name: "going", input: { participation: "going" }, label: "Going", primary: false, cancel: "Cancel RSVP" },
    { name: "waitlisted", input: { participation: "waitlisted" }, label: "Waitlisted", primary: false, cancel: "Leave waitlist" },
    { name: "full with a waitlist", input: { full: true, waitlistEnabled: true }, label: "Waitlist", primary: true },
    { name: "full, visitor", input: { full: true, waitlistEnabled: true, authenticated: false }, label: "Waitlist", primary: true },
    { name: "full without a waitlist", input: { full: true }, label: "Sold out", primary: false },
    { name: "ended", input: { ended: true }, label: "Ended", primary: false },
    { name: "cancelled", input: { cancelled: true }, label: "Cancelled", primary: false },
    { name: "paid tickets sold nowhere", input: { nativePaid: true }, label: "Tickets unavailable", primary: false },
    { name: "hosting", input: { hosting: true }, label: "You're hosting", primary: false },
  ];

  it.each(cases)("$name: $label, with $primary primary button(s) and never a second booking-shaped one", ({ input, label, primary: isPrimary, cancel }) => {
    draw({ control: controlFor(input), reason: getEventBookingReason(getEventBookingState({ ...availableInput, ...input })) });
    expect(primary()).toHaveLength(isPrimary ? 1 : 0);
    if (isPrimary) {
      expect(screen.getByRole("button", { name: label })).toBe(primary()[0]);
    } else {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
      expect(document.querySelector(`[data-booking-state="${label}"]`)).not.toBeNull();
    }
    if (cancel) expect(screen.getByRole("button", { name: cancel })).toBeInTheDocument();
    else expect(screen.queryByRole("button", { name: /cancel rsvp|leave waitlist/i })).not.toBeInTheDocument();
  });

  it("gives a guest who just RSVP'd no Cancel RSVP: there is no account to cancel from", () => {
    draw({ isAuthenticated: false, control: controlFor({ participation: "going", authenticated: false }) });
    expect(document.querySelector('[data-booking-state="Going"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel RSVP" })).not.toBeInTheDocument();
  });

  it("disables the primary button while the join is in flight", () => {
    draw({ joining: true });
    expect(document.querySelector('[data-booking-cta="primary"]')).toBeDisabled();
  });

  it("says why a control cannot be used, once, and ties the status to it", () => {
    draw({ control: controlFor({ full: true }), reason: "This event is full and no waitlist is available." });
    expect(screen.getAllByText("This event is full and no waitlist is available.")).toHaveLength(1);
    const reason = screen.getByText("This event is full and no waitlist is available.");
    expect(reason.id).not.toBe("");
    expect(document.querySelector('[data-booking-state="Sold out"]')).toHaveAttribute("aria-describedby", reason.id);
  });

  it("says places left from the server's count only: nothing while the count is unknown", () => {
    const { unmount } = draw({ capacity: 10, participantCount: 4 });
    expect(screen.getByText("6 places left")).toBeInTheDocument();
    unmount();
    draw({ capacity: 10, participantCount: null });
    expect(text()).not.toMatch(/places? left/);
    expect(screen.getByText("Attendance count unavailable")).toBeInTheDocument();
  });

  it("offers tickets sold elsewhere as a link that opens the seller, never as a second button", () => {
    draw({ ticketUrl: "https://tickets.example.com/e1", priceLabel: "€20" });
    const link = screen.getByRole("link", { name: /Get tickets/ });
    expect(link).toHaveAttribute("href", "https://tickets.example.com/e1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(primary()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /tickets/i })).not.toBeInTheDocument();
    expect(text()).toContain("Tickets and payment are handled by the seller, not by Kretopia.");
  });
});

describe("EventBookingBlock: leaving is one confirmation, and the result is shown once", () => {
  it("asks once, and does nothing if the member keeps their spot", async () => {
    const { p } = draw({ control: controlFor({ participation: "going" }) });
    fireEvent.click(screen.getByRole("button", { name: "Cancel RSVP" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Release your spot?");
    expect(confirm).toHaveTextContent("Studio Night");
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep my spot" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(p.onCancelRsvp).not.toHaveBeenCalled();
  });

  it("cancels exactly once when confirmed", async () => {
    const { p } = draw({ control: controlFor({ participation: "going" }) });
    fireEvent.click(screen.getByRole("button", { name: "Cancel RSVP" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, cancel RSVP" }));
    expect(p.onCancelRsvp).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("words leaving the waitlist as leaving a queue, not as releasing a place", async () => {
    const { p } = draw({ control: controlFor({ participation: "waitlisted" }) });
    fireEvent.click(screen.getByRole("button", { name: "Leave waitlist" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Leave the waitlist?");
    expect(confirm).not.toHaveTextContent("Release your spot");
    fireEvent.click(within(confirm).getByRole("button", { name: "Yes, leave waitlist" }));
    expect(p.onCancelRsvp).toHaveBeenCalledOnce();
  });

  it("moves focus to the control that replaced the one the member used", async () => {
    const { again } = draw({ control: controlFor({ participation: "going" }) });
    fireEvent.click(screen.getByRole("button", { name: "Cancel RSVP" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, cancel RSVP" }));
    again({ control: controlFor(), joining: false });
    await waitFor(() => expect(screen.getByRole("button", { name: "I'm Going" })).toHaveFocus());
  });

  it("tells what happened in one line, as a status (an error as an alert), and can be dismissed", () => {
    const { p, unmount } = draw({ rsvpNotice: { tone: "success", text: "You're going. Your place is confirmed." } });
    expect(screen.getAllByText("You're going. Your place is confirmed.")).toHaveLength(1);
    expect(document.querySelector('[data-rsvp-notice="success"]')).toHaveAttribute("role", "status");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(p.onDismissNotice).toHaveBeenCalledOnce();
    unmount();

    draw({ rsvpNotice: { tone: "error", text: "This event is full, and the host hasn't opened a waitlist." } });
    expect(screen.getByRole("alert")).toHaveTextContent("This event is full");
  });
});

describe("EventBookingBlock: who is going", () => {
  it("draws the avatars and the count once, and nothing else about them", () => {
    draw({ participantCount: 3 });
    const row = section("participants")!;
    expect(within(row).getByRole("button", { name: "3 going: Ari, Bea, Cam. View everyone going." })).toBeInTheDocument();
    expect(count(/3 going/)).toBe(1);
  });

  it.each([
    [0, "Be the first to join."],
    [null, "Attendance count unavailable"],
  ])("says %s going as %s, with no list to open", (participantCount, line) => {
    draw({ participantCount: participantCount as number | null });
    expect(section("participants")).toHaveTextContent(line);
    expect(within(section("participants") as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the avatars off the page when the host keeps the list private, but still says how many", () => {
    draw({ participantCount: 5, attendeesVisible: false });
    const row = section("participants")!;
    expect(row).toHaveTextContent("5 going");
    expect(within(row as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the list of everyone from the avatar stack, and a row opens that member's public Passport", async () => {
    m.participants = [{ id: "1", user_id: "u1", guest_name: null, joined_at: "2026-11-01T10:00:00Z" }];
    m.profiles = [{ user_id: "u1", full_name: "Ari Stone", avatar_url: null, role: "Producer" }];
    draw();

    const stack = screen.getByRole("button", { name: /View everyone going/ });
    stack.focus();
    fireEvent.click(stack);
    const dialog = await screen.findByRole("dialog", { name: "Who's going" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const link = await within(dialog).findByRole("link", { name: /Ari Stone/ });
    expect(link).toHaveAttribute("href", "/epk/u1");

    fireEvent.click(link);
    expect(await screen.findByText("Public Passport page")).toBeInTheDocument();
  });

  it("closes on Escape and gives focus back to the avatar stack", async () => {
    draw();
    const stack = screen.getByRole("button", { name: /View everyone going/ });
    stack.focus();
    fireEvent.click(stack);
    await screen.findByRole("dialog", { name: "Who's going" });
    await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(stack).toHaveFocus());
  });

  it("does not read the guest list until it is opened", async () => {
    draw();
    expect(m.reads).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /View everyone going/ }));
    await screen.findByRole("dialog", { name: "Who's going" });
    await waitFor(() => expect(m.reads).toContain("jam_participants"));
  });
});

describe("EventBookingBlock: the control follows the viewer on a phone, and is never duplicated", () => {
  class FakeObserver {
    static instances: FakeObserver[] = [];
    constructor(public callback: IntersectionObserverCallback) { FakeObserver.instances.push(this); }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const setMedia = (narrow: boolean) => Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: narrow && query === "(max-width: 1023px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }),
  });
  const scrollAway = (away: boolean) => act(() => {
    const observer = FakeObserver.instances.at(-1)!;
    observer.callback([{ isIntersecting: !away } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
  });
  const bar = () => document.querySelector('[data-event-slot="sticky-booking"]');

  beforeEach(() => { FakeObserver.instances = []; vi.stubGlobal("IntersectionObserver", FakeObserver); });

  it("keeps the control in the block while the block is on screen, with no bar", () => {
    setMedia(true);
    draw();
    expect(primary()).toHaveLength(1);
    expect(bar()).toBeNull();
  });

  it("moves (not copies) the control into a bar above the bottom nav once the block scrolls away, and back", () => {
    setMedia(true);
    const { p } = draw({ bottomNav: true });
    scrollAway(true);

    expect(primary()).toHaveLength(1);
    expect(bar()).not.toBeNull();
    expect(bar()!.querySelector('[data-booking-cta="primary"]')).not.toBeNull();
    expect(section("admission")!.querySelector('[data-booking-cta="primary"]')).toBeNull();
    expect(bar()!.className).toContain("bottom-[calc(3.7rem");
    expect(bar()!.className).toContain("lg:hidden");
    // Under the Kreto launcher (z-40) and the nav (z-50), and clear of the launcher at the right.
    expect(bar()!.className).toContain("z-30");
    expect(bar()!.className).toContain("pr-[6.25rem]");
    fireEvent.click(within(bar() as HTMLElement).getByRole("button", { name: "I'm Going" }));
    expect(p.onBook).toHaveBeenCalledOnce();

    scrollAway(false);
    expect(primary()).toHaveLength(1);
    expect(bar()).toBeNull();
    expect(section("admission")!.querySelector('[data-booking-cta="primary"]')).not.toBeNull();
  });

  it("sits at the screen's edge when there is no bottom nav (a visitor)", () => {
    setMedia(true);
    draw({ bottomNav: false });
    scrollAway(true);
    expect(bar()!.className).toContain("bottom-0");
    expect(bar()!.className).not.toContain("3.7rem");
    expect(bar()!.className).not.toContain("pr-[6.25rem]");
  });

  it("never follows the viewer from lg, where the block itself is sticky", () => {
    setMedia(false);
    draw();
    scrollAway(true);
    expect(bar()).toBeNull();
    expect(primary()).toHaveLength(1);
    expect(section("admission")!.querySelector('[data-booking-cta="primary"]')).not.toBeNull();
  });

  it("does not follow the viewer with a status: Going, Sold out and Ended stay in the block", () => {
    setMedia(true);
    draw({ control: controlFor({ participation: "going" }) });
    scrollAway(true);
    expect(bar()).toBeNull();
    expect(document.querySelector('[data-booking-state="Going"]')).not.toBeNull();
    expect(primary()).toHaveLength(0);
  });
});
