import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Event page as a whole: what putting an event on a calendar does and does not do, where the host's tools are, who sees the
 * host-editable sections, and leaving an event against the database production has. Only the database is stood in for (a table-aware query builder that records every write); the page, its hero,
 * calendar actions, host bar, sections dialog and booking rail are the real ones.
 */
type DbError = { code?: string; message: string } | null;
const missing: DbError = { code: "PGRST205", message: "Could not find the table in the schema cache" };

const m = vi.hoisted(() => {
  const s = {
    user: null as { id: string } | null,
    event: {} as Record<string, unknown>,
    going: 3,
    participation: null as string | null,
    participantRows: [] as unknown[],
    profileRows: [] as unknown[],
    /** How many of the next reads of the viewer's own participation row fail (a dropped connection). */
    ownRowReadFailures: 0,
    calendar: { rows: [] as { event_id: string }[], error: null as DbError, writeError: null as DbError },
    hostSections: { rows: [] as unknown[], error: null as DbError, writeError: null as DbError },
    publicSections: { rows: [] as unknown[], error: null as DbError },
    log: [] as { table: string; op: string; payload: unknown }[],
    rpc: vi.fn(),
    toast: vi.fn(),
    downloadIcs: vi.fn(),
    clipboard: vi.fn(),
  };
  type Ctx = { table: string; op: string; single: boolean; head: boolean; payload: unknown };
  const answer = (c: Ctx) => {
    switch (c.table) {
      case "creative_jams":
        if (c.op !== "select") return { data: null, error: null };
        if (c.head) return { data: null, count: 1, error: null };
        return c.single ? { data: s.event, error: null } : { data: [], error: null };
      case "public_profiles_safe":
        return c.single ? { data: { user_id: "host", full_name: "Ada Host" }, error: null } : { data: s.profileRows, error: null };
      case "profiles":
        return { data: { username: "ada" }, error: null };
      case "jam_participants":
        if (c.op !== "select") return { data: null, error: null };
        if (c.head) return { data: null, count: s.going, error: null };
        if (c.single) {
          if (s.ownRowReadFailures > 0) { s.ownRowReadFailures -= 1; return { data: null, error: { code: "08006", message: "connection lost" } }; }
          return { data: s.participation ? { id: "p1", status: s.participation } : null, error: null };
        }
        return { data: s.participantRows, error: null };
      case "event_calendar_entries":
        return c.op === "select" ? { data: s.calendar.rows, error: s.calendar.error } : { data: null, error: s.calendar.writeError };
      case "event_page_sections":
        return c.op === "select" ? { data: s.hostSections.rows, error: s.hostSections.error } : { data: null, error: s.hostSections.writeError };
      case "event_page_sections_public":
        return { data: s.publicSections.rows, error: s.publicSections.error };
      default:
        return { data: [], error: null };
    }
  };
  const query = (table: string) => {
    const ctx: Ctx = { table, op: "select", single: false, head: false, payload: undefined };
    const proxy: unknown = new Proxy({}, {
      get(_target, prop: string) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
            s.log.push({ table, op: ctx.op, payload: ctx.payload });
            return Promise.resolve(answer(ctx)).then(resolve, reject);
          };
        }
        return (...args: unknown[]) => {
          if (prop === "single" || prop === "maybeSingle") ctx.single = true;
          if (["insert", "upsert", "update", "delete"].includes(prop)) { ctx.op = prop; ctx.payload = args[0]; }
          if (prop === "select" && (args[1] as { head?: boolean } | undefined)?.head) ctx.head = true;
          return proxy;
        };
      },
    });
    return proxy;
  };
  // The tests assign to `m` (the same object the query builder reads), so hand back `s` itself rather than a copy.
  return Object.assign(s, { query });
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => m.query(table),
    rpc: (...args: unknown[]) => m.rpc(...args),
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: m.user, loading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("react-helmet-async", () => ({ Helmet: ({ children }: { children: ReactNode }) => <div data-testid="helmet">{children}</div> }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/brand/KretoScene", () => ({ KretoScene: () => null }));
vi.mock("@/utils/eventConfirmationEmail", () => ({ sendEventConfirmationEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/eventActions", () => ({
  captureRefFromUrl: vi.fn().mockResolvedValue(null),
  buildWarmShareMessage: vi.fn(() => ""),
  buildEventShareUrl: vi.fn(() => ""),
  openDirections: vi.fn(),
  downloadIcs: (...args: unknown[]) => m.downloadIcs(...args),
}));
// Everything below is another feature that the page merely hosts: standing in for it keeps this test about the page.
vi.mock("@/components/sessions/EventShareKit", () => ({ EventShareKit: () => null }));
vi.mock("@/components/sessions/EditEventDialog", () => ({ EditEventDialog: () => null }));
vi.mock("@/components/sessions/EventCheckInDialog", () => ({ EventCheckInDialog: () => null }));
vi.mock("@/components/sessions/EventCohosts", () => ({ EventCohosts: () => null }));
vi.mock("@/components/sessions/EventRecapButton", () => ({ EventRecapButton: () => null }));
vi.mock("@/components/sessions/EventCommunityHub", () => ({ EventCommunityHub: () => null }));
vi.mock("@/components/sessions/EventPhotoWall", () => ({ EventPhotoWall: () => null }));
vi.mock("@/components/sessions/JoinOnlineCard", () => ({ JoinOnlineCard: () => null }));
vi.mock("@/components/sessions/GuestRsvpDialog", () => ({ GuestRsvpDialog: () => null }));
vi.mock("@/components/sessions/GuestPassDialog", () => ({ GuestPassDialog: () => null }));
vi.mock("@/components/messages/ShareToMessageDialog", () => ({ ShareToMessageDialog: () => null }));

import EventPage from "../EventPage";
import { sendEventConfirmationEmail } from "@/utils/eventConfirmationEmail";

const DAY = 86_400_000;
const baseEvent = () => ({
  id: "e1", title: "Studio Night", description: "Bring stems.", category: "music", created_by: "host", is_public: true, status: "upcoming",
  event_mode: "irl", start_time: new Date(Date.now() + 30 * DAY).toISOString(), end_time: new Date(Date.now() + 30 * DAY + 3 * 3_600_000).toISOString(),
  venue_name: "Studio Nine", venue_address: "1 Rue Exemple, Paris", max_participants: 0, is_ticketed: false, ticket_price: 0, external_ticket_url: null,
  attendee_list_visibility: "public", require_account_for_rsvp: false, waitlist_enabled: false, cover_image_url: "https://img.example.com/c.jpg", gallery_image_urls: [],
});

const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
};

const draw = async () => {
  render(
    <MemoryRouter initialEntries={["/event/e1"]}>
      <Routes>
        <Route path="/event/:eventId" element={<EventPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: "Studio Night" });
};

const viewer = { id: "viewer" };
const host = { id: "host" };
const writesTo = (table: string) => m.log.filter((entry) => entry.table === table && entry.op !== "select");
// The hero's calendar menu (the Event page also has a calendar workspace with buttons of its own).
const calendarTrigger = () => screen.getByRole("button", { name: /^(Add to calendar|Calendar: on my calendar)$/ });
const openCalendarMenu = () => fireEvent.keyDown(calendarTrigger(), { key: "Enter" });
const jsonLd = () => JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent ?? "{}");
const section = (id: string) => document.getElementById(id);

beforeEach(() => {
  m.user = null;
  m.event = baseEvent();
  m.going = 3;
  m.participation = null;
  m.participantRows = [];
  m.profileRows = [];
  m.ownRowReadFailures = 0;
  m.calendar = { rows: [], error: null, writeError: null };
  m.hostSections = { rows: [], error: null, writeError: null };
  m.publicSections = { rows: [], error: null };
  m.log.length = 0;
  m.rpc.mockReset().mockResolvedValue({ data: "joined", error: null });
  m.toast.mockReset();
  vi.mocked(sendEventConfirmationEmail).mockClear();
  m.downloadIcs.mockReset();
  vi.stubGlobal("open", vi.fn());
});

describe("Event page: putting the event on a calendar is not an RSVP, a reservation or a ticket", () => {
  it("adds it to my Kretopia calendar and nothing else: no RSVP, no attendance row, no count change, no ticket step", async () => {
    m.user = viewer;
    await draw();
    openCalendarMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to my calendar" }));

    await waitFor(() => expect(writesTo("event_calendar_entries")).toHaveLength(1));
    expect(writesTo("event_calendar_entries")[0]).toMatchObject({ op: "upsert", payload: { user_id: "viewer", event_id: "e1" } });
    expect(m.rpc).not.toHaveBeenCalled();
    expect(writesTo("jam_participants")).toEqual([]);
    expect(m.toast).toHaveBeenCalledWith({
      title: "Added to your Kretopia calendar",
      description: "This only puts it on your calendar. It does not RSVP you or reserve a place.",
    });
    expect(window.open).not.toHaveBeenCalled();
    // The page says what the server confirmed, and never claims a booking: the count and the RSVP button are as they were.
    expect(await screen.findByRole("button", { name: "Calendar: on my calendar" })).toBeInTheDocument();
    expect(screen.getAllByText(/3 going/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "I'm Going" }).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/booking confirmed|you're in|ticket confirmed/i);
  });

  it("taking it off the calendar leaves an RSVP alone", async () => {
    m.user = viewer;
    m.participation = "going";
    m.calendar.rows = [{ event_id: "e1" }];
    await draw();
    openCalendarMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove from my calendar" }));

    await waitFor(() => expect(writesTo("event_calendar_entries")).toHaveLength(1));
    expect(writesTo("event_calendar_entries")[0].op).toBe("delete");
    expect(m.rpc).not.toHaveBeenCalled();
    expect(writesTo("jam_participants")).toEqual([]);
    expect(m.toast).toHaveBeenCalledWith({ title: "Removed from your Kretopia calendar", description: "Your RSVP, if you have one, is unchanged." });
    // Still going: "Going" is the booking control's status, with its leaving action beside it.
    expect(document.querySelector('[data-booking-state="Going"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancel RSVP" })).toBeInTheDocument();
  });

  it("while saving is not available, says so, saves nothing, and still exports the event", async () => {
    m.user = viewer;
    m.calendar.error = missing;
    await draw();
    openCalendarMenu();
    const save = await screen.findByRole("menuitem", { name: "Add to my calendar" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Saving to your Kretopia calendar isn't available yet");
    fireEvent.click(save);
    expect(writesTo("event_calendar_entries")).toEqual([]);

    fireEvent.click(screen.getByRole("menuitem", { name: ".ics file (Apple, Outlook)" }));
    expect(m.downloadIcs).toHaveBeenCalledWith(expect.objectContaining({ id: "e1", title: "Studio Night", venueAddress: "1 Rue Exemple, Paris" }));
    openCalendarMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Google Calendar" }));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining("https://calendar.google.com/calendar/render?"), "_blank", "noopener,noreferrer");
  });

  it("a failed save is reported as not added, and the event is not shown as saved", async () => {
    m.user = viewer;
    m.calendar.writeError = { code: "42501", message: "new row violates row-level security policy" };
    await draw();
    openCalendarMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to my calendar" }));
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Not added to your calendar", variant: "destructive" })));
    expect(screen.queryByRole("button", { name: "Calendar: on my calendar" })).not.toBeInTheDocument();
  });

  it("a visitor who is not signed in is sent to sign in, not signed in silently, and nothing is saved", async () => {
    await draw();
    openCalendarMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign in to add to my calendar" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/auth?event=e1&tab=signup");
    expect(writesTo("event_calendar_entries")).toEqual([]);
  });
});

describe("Event page: tickets sold elsewhere are their own action", () => {
  beforeEach(() => {
    m.event = { ...baseEvent(), is_ticketed: true, ticket_price: 20, ticket_currency: "EUR", external_ticket_url: "https://tickets.example.com/studio-night" };
  });

  it("offers a Get tickets link to the seller, apart from the RSVP button, and the RSVP does not open it", async () => {
    m.user = viewer;
    await draw();
    const links = screen.getAllByRole("link", { name: /Get tickets/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "https://tickets.example.com/studio-night");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    fireEvent.click(screen.getAllByRole("button", { name: "I'm Going" })[0]);
    await waitFor(() => expect(m.rpc).toHaveBeenCalledWith("rsvp_to_event", expect.objectContaining({ p_event_id: "e1" })));
    expect(window.open).not.toHaveBeenCalled();
  });

  it("saving to the calendar does not buy, open or reserve anything", async () => {
    m.user = viewer;
    await draw();
    openCalendarMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to my calendar" }));
    await waitFor(() => expect(writesTo("event_calendar_entries")).toHaveLength(1));
    expect(window.open).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("offers no ticket link once the event is over or cancelled", async () => {
    m.event = { ...(m.event as object), status: "cancelled" };
    await draw();
    expect(screen.queryByRole("link", { name: /Get tickets/ })).not.toBeInTheDocument();
  });

  it("a paid event with no external seller does not pretend to sell tickets here", async () => {
    m.event = { ...baseEvent(), is_ticketed: true, ticket_price: 20, ticket_currency: "EUR", external_ticket_url: null };
    m.user = viewer;
    await draw();
    expect(screen.queryByRole("link", { name: /Get tickets/ })).not.toBeInTheDocument();
    // Nothing to press: the control is a status, and there is no booking button on the page.
    expect(document.querySelector('[data-booking-state="Tickets unavailable"]')).not.toBeNull();
    expect(document.querySelector('[data-booking-cta="primary"]')).toBeNull();
  });
});

describe("Event page: the host's tools", () => {
  it("are not drawn for a visitor or for a signed-in guest", async () => {
    await draw();
    expect(screen.queryByRole("region", { name: "Host tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit page sections" })).not.toBeInTheDocument();
  });

  it("are drawn for the creator right under the header, before the About section", async () => {
    m.user = host;
    await draw();
    const bar = await screen.findByRole("region", { name: "Host tools" });
    const hero = section("hero")!;
    const about = section("about")!;
    expect(hero.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const name of ["Edit event", "Edit page sections", "Check-in", "Share / QR", "More host tools"]) {
      expect(within(bar).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("a guest who is not the creator gets neither the bar nor the sections editor, even with the same event open", async () => {
    m.user = viewer;
    await draw();
    expect(screen.queryByRole("region", { name: "Host tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit page sections" })).not.toBeInTheDocument();
  });
});

describe("Event page: the sections the host can write and hide", () => {
  it("with nothing written, every section shows the page's own default text, as old events always did", async () => {
    await draw();
    expect(section("about-program")).toHaveTextContent("No line-up or program details are listed for this event.");
    expect(section("about-venue")).toHaveTextContent("Studio Nine");
    expect(section("about-policies")).toHaveTextContent("Guests may RSVP without creating an account.");
    expect(section("about-faq")).toHaveTextContent("How do I RSVP?");
  });

  it("shows a visitor what the host wrote, and nothing at all of a section the host hid", async () => {
    m.publicSections.rows = [
      { section: "program", content: { text: "19:00 Doors\n20:00 Live set" }, is_visible: true },
      { section: "policies", content: {}, is_visible: false },
      { section: "faq", content: { items: [{ question: "Parking?", answer: "Behind the venue." }] }, is_visible: true },
    ];
    await draw();
    expect(section("about-program")).toHaveTextContent("20:00 Live set");
    expect(section("about-faq")).toHaveTextContent("Parking?");
    expect(section("about-faq")).not.toHaveTextContent("How do I RSVP?");
    expect(section("about-policies")).toBeNull();
    expect(screen.queryByRole("link", { name: "View policies" })).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden from visitors")).not.toBeInTheDocument();
  });

  it("shows the host the same section, with its words, marked as hidden from visitors", async () => {
    m.user = host;
    m.hostSections.rows = [{ section: "policies", content: { text: "No refunds." }, is_visible: false }];
    await draw();
    await waitFor(() => expect(section("about-policies")).not.toBeNull());
    expect(section("about-policies")).toHaveTextContent("No refunds.");
    expect(section("about-policies")).toHaveTextContent("Hidden from visitors");
  });

  it("the host reads the sections table, a visitor reads the public view", async () => {
    m.user = host;
    await draw();
    await waitFor(() => expect(m.log.some((entry) => entry.table === "event_page_sections")).toBe(true));
    expect(m.log.some((entry) => entry.table === "event_page_sections_public")).toBe(false);
  });

  it("a visitor reads only the redacting view", async () => {
    await draw();
    expect(m.log.some((entry) => entry.table === "event_page_sections_public")).toBe(true);
    expect(m.log.some((entry) => entry.table === "event_page_sections")).toBe(false);
  });

  it("the host edits and saves all four sections in one write, and the page shows the new words", async () => {
    m.user = host;
    await draw();
    fireEvent.click(await screen.findByRole("button", { name: "Edit page sections" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit page sections" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Program / line-up" }), { target: { value: "19:00 Doors\n20:00 Live set" } });
    fireEvent.click(within(dialog).getByRole("switch", { name: "Show Policies on the event page" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save sections" }));

    await waitFor(() => expect(writesTo("event_page_sections")).toHaveLength(1));
    const rows = writesTo("event_page_sections")[0].payload as { section: string; is_visible: boolean; content: { text?: string } }[];
    expect(rows.map((row) => row.section).sort()).toEqual(["faq", "policies", "program", "venue"]);
    expect(rows.find((row) => row.section === "policies")?.is_visible).toBe(false);
    expect(rows.find((row) => row.section === "program")?.content.text).toBe("19:00 Doors\n20:00 Live set");
    // Nothing but the sections table was written: the event itself is untouched.
    expect(writesTo("creative_jams")).toEqual([]);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit page sections" })).not.toBeInTheDocument());
    expect(section("about-program")).toHaveTextContent("20:00 Live set");
    expect(section("about-policies")).toHaveTextContent("Hidden from visitors");
  });

  it("while the sections table does not exist, the host is told editing is not available and nothing is saved", async () => {
    m.user = host;
    m.hostSections.error = missing;
    await draw();
    fireEvent.click(await screen.findByRole("button", { name: "Edit page sections" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit page sections" });
    expect(within(dialog).getByRole("status")).toHaveTextContent("Editing page sections isn't available yet");
    expect(within(dialog).getByRole("button", { name: "Save sections" })).toBeDisabled();
    expect(writesTo("event_page_sections")).toEqual([]);
    // The page itself still shows its defaults.
    expect(section("about-faq")).toHaveTextContent("How do I RSVP?");
  });
});

describe("Event page: a hidden Venue keeps the address off every public render path", () => {
  const venueHidden = { section: "venue", content: {}, is_visible: false };

  it("shows a visitor the venue's name but no address, no map, no calendar-export address and no address in the structured data", async () => {
    m.user = viewer;
    m.publicSections.rows = [venueHidden];
    await draw();
    expect(document.body.textContent).not.toContain("1 Rue Exemple");
    expect(screen.queryByRole("button", { name: /Open map/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Studio Nine/).length).toBeGreaterThan(0);
    expect(section("about-venue")).toBeNull();
    expect(jsonLd().location).toEqual({ "@type": "Place", name: "Studio Nine" });

    openCalendarMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: ".ics file (Apple, Outlook)" }));
    expect(m.downloadIcs).toHaveBeenCalledWith(expect.objectContaining({ venueName: "Studio Nine", venueAddress: null }));
    openCalendarMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Google Calendar" }));
    expect(decodeURIComponent((window.open as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string)).not.toContain("1 Rue Exemple");
  });

  it("still shows the host the address, marked, so it can be edited and turned back on", async () => {
    m.user = host;
    m.hostSections.rows = [{ section: "venue", content: { text: "Side entrance." }, is_visible: false }];
    await draw();
    await waitFor(() => expect(section("about-venue")).not.toBeNull());
    expect(section("about-venue")).toHaveTextContent("1 Rue Exemple, Paris");
    expect(section("about-venue")).toHaveTextContent("Side entrance.");
    expect(section("about-venue")).toHaveTextContent("Hidden from visitors");
  });

  it("shows the address when the Venue is shown, in the hero, the calendar export and the structured data", async () => {
    m.user = viewer;
    await draw();
    expect(screen.getAllByText(/1 Rue Exemple, Paris/).length).toBeGreaterThan(0);
    expect(jsonLd().location).toEqual({ "@type": "Place", name: "Studio Nine", address: "1 Rue Exemple, Paris" });
    expect(screen.getByRole("button", { name: /Open map/ })).toBeInTheDocument();
  });

  it("does not show a visitor the address when the sections could not be read, because it is not known whether the host hid it", async () => {
    m.user = viewer;
    m.publicSections.error = { code: "08006", message: "connection lost" };
    await draw();
    expect(document.body.textContent).not.toContain("1 Rue Exemple");
    expect(jsonLd().location).toEqual({ "@type": "Place", name: "Studio Nine" });
  });
});

describe("Event page: leaving an event against a database that has not got cancel_event_rsvp (production, 2026-11-10)", () => {
  // What production's API answered for that function: HTTP 404, PGRST202. It exists only in migration 20261109130000, which production has not got.
  const CANCEL_MISSING = { code: "PGRST202", message: "Could not find the function public.cancel_event_rsvp(p_event_id) in the schema cache" };

  const RELEASED = "Your RSVP is cancelled. Your spot has been released.";
  // Leaving is one quiet action in the booking block and one confirmation; the result is told once, in the block.
  const cancelFromTheBlock = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Cancel RSVP" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, cancel RSVP" }));
  };

  beforeEach(() => {
    m.user = viewer;
    m.participation = "going";
  });

  it("still releases the spot, by setting the member's own row to cancelled, and says so", async () => {
    m.rpc.mockImplementation(async (name: string) => (name === "cancel_event_rsvp" ? { data: null, error: CANCEL_MISSING } : { data: "joined", error: null }));
    await draw();
    await cancelFromTheBlock();

    expect(await screen.findByText(RELEASED)).toBeInTheDocument();
    expect(writesTo("jam_participants")).toEqual([{ table: "jam_participants", op: "update", payload: { status: "cancelled" } }]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Said once: no toast repeats it. And the page no longer shows the member as going.
    expect(m.toast).not.toHaveBeenCalled();
    expect(screen.getAllByText(RELEASED)).toHaveLength(1);
    expect((await screen.findAllByRole("button", { name: "I'm Going" })).length).toBe(1);
  });

  it("uses the cancel function when the database has it, and writes no row itself", async () => {
    m.rpc.mockResolvedValue({ data: "cancelled", error: null });
    await draw();
    await cancelFromTheBlock();

    expect(await screen.findByText(RELEASED)).toBeInTheDocument();
    expect(m.rpc).toHaveBeenCalledWith("cancel_event_rsvp", { p_event_id: "e1" });
    expect(writesTo("jam_participants")).toEqual([]);
  });

  it("reports a real refusal as one, and does not retry it as a table update", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "auth_required" } });
    await draw();
    await cancelFromTheBlock();

    // A real refusal is shown as one, in the block, and the member is still shown as going.
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(writesTo("jam_participants")).toEqual([]);
    expect(screen.queryByText(RELEASED)).not.toBeInTheDocument();
    expect(document.querySelector('[data-booking-state="Going"]')).not.toBeNull();
  });
});

// ---- One wrapper, one booking block, one primary action ------------------------------------------------------------------------------

const primaryButtons = () => document.querySelectorAll('[data-booking-cta="primary"]');
const bookingState = () => document.querySelector("[data-booking-state]")?.getAttribute("data-booking-state") ?? null;
const occurrences = (needle: string | RegExp) => (typeof needle === "string" ? (document.body.textContent ?? "").split(needle).length - 1 : ((document.body.textContent ?? "").match(new RegExp(needle, "g")) ?? []).length);

describe("Event page: one wrapper, one booking block", () => {
  it("is one shell holding the cover, the one booking block, then the content, in that order", async () => {
    m.user = viewer;
    await draw();
    const shell = screen.getByRole("region", { name: "Studio Night" });
    const blocks = shell.querySelectorAll('[data-event-slot]');
    expect([...blocks].map((node) => node.getAttribute("data-event-slot"))).toEqual(["hero", "booking", "main"]);
    expect(shell.querySelectorAll('[aria-label="Event booking"]')).toHaveLength(1);
    expect(shell.querySelectorAll('[class~="max-w-7xl"]')).toHaveLength(1);
    const main = shell.querySelector('[data-event-slot="main"]')!;
    expect(main.querySelector("#about")).not.toBeNull();
    expect(shell.querySelector('[data-event-slot="hero"]')).toContainElement(document.getElementById("hero"));
    expect(shell.querySelector('[data-event-slot="booking"]')).toContainElement(document.getElementById("host"));
  });

  it("says price, date, count and places once each: no Event options list, no Admission block, no second countdown", async () => {
    m.user = viewer;
    m.event = { ...baseEvent(), is_ticketed: true, ticket_price: 20, ticket_currency: "EUR", external_ticket_url: "https://tickets.example.com/e1", max_participants: 10 };
    m.going = 7;
    await draw();

    expect(occurrences(/€\s?20|20[.,]00/)).toBe(1);
    expect(occurrences(/7 going/)).toBe(1);
    expect(occurrences("3 places left")).toBe(1);
    expect(occurrences("Starts in")).toBe(1);
    expect(screen.getAllByRole("timer")).toHaveLength(1);
    expect(occurrences("Free")).toBe(0);
    expect(occurrences(/Admission|Event options/)).toBe(0);
    expect(screen.queryByRole("heading", { name: /event options/i })).not.toBeInTheDocument();
    // One date line (the calendar's agenda is another feature and is not drawn until it is opened).
    const when = formatEventTimeForTest(m.event.start_time as string);
    expect(occurrences(when)).toBe(1);
  });

  it("puts a cancelled event's notice first, above the cover, and says the reason once", async () => {
    m.user = viewer;
    m.event = { ...baseEvent(), status: "cancelled", status_note: "The venue flooded." };
    await draw();
    const notice = screen.getByText("Event Cancelled");
    expect(notice.compareDocumentPosition(document.getElementById("hero")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(occurrences("The venue flooded.")).toBe(1);
    expect(occurrences("The host cancelled this event.")).toBe(0);
    expect(bookingState()).toBe("Cancelled");
    expect(primaryButtons()).toHaveLength(0);
  });

  it("says Free once for a free event", async () => {
    await draw();
    expect(occurrences("Free")).toBe(1);
  });

  it("keeps every deep link: #event-booking, #host, #attendees, #about-policies", async () => {
    m.user = viewer;
    await draw();
    for (const id of ["event-booking", "host", "attendees", "about-policies"]) {
      expect(document.querySelectorAll(`#${id}`), id).toHaveLength(1);
    }
    expect(document.getElementById("event-booking")).toContainElement(primaryButtons()[0] as HTMLElement);
    expect(document.getElementById("event-booking")).toContainElement(document.getElementById("host"));
    expect(screen.getByRole("link", { name: "Event policies" })).toHaveAttribute("href", "#about-policies");
    expect(document.getElementById("about-policies")).toHaveTextContent("Policies");
  });

  it("has no standalone Host card, Attendees section header with a second count, or Policies row", async () => {
    m.user = viewer;
    await draw();
    expect(document.querySelectorAll("#host")).toHaveLength(1);
    expect(screen.queryByText("View policies")).not.toBeInTheDocument();
    expect(screen.queryByText("Contact via Kretopia")).not.toBeInTheDocument();
    expect(occurrences(/Contact host/)).toBe(1);
  });
});

describe("Event page: one primary action, from a visitor's first screen to a phone's bottom bar", () => {
  const scenarios: { name: string; setup: () => void; label: string; primary: number }[] = [
    { name: "a visitor with a free place", setup: () => { m.user = null; }, label: "I'm Going", primary: 1 },
    { name: "a member with a free place", setup: () => { m.user = viewer; }, label: "I'm Going", primary: 1 },
    { name: "a member who is going", setup: () => { m.user = viewer; m.participation = "going"; }, label: "Going", primary: 0 },
    { name: "a member on the waitlist", setup: () => { m.user = viewer; m.participation = "waitlisted"; }, label: "Waitlisted", primary: 0 },
    { name: "a full event with a waitlist", setup: () => { m.user = viewer; m.event = { ...baseEvent(), max_participants: 3, waitlist_enabled: true }; }, label: "Waitlist", primary: 1 },
    { name: "a full event without one", setup: () => { m.user = viewer; m.event = { ...baseEvent(), max_participants: 3 }; }, label: "Sold out", primary: 0 },
    { name: "a cancelled event", setup: () => { m.user = viewer; m.event = { ...baseEvent(), status: "cancelled" }; }, label: "Cancelled", primary: 0 },
    { name: "an event that has ended", setup: () => { m.user = viewer; m.event = { ...baseEvent(), start_time: new Date(Date.now() - 2 * DAY).toISOString(), end_time: new Date(Date.now() - DAY).toISOString() }; }, label: "Ended", primary: 0 },
    { name: "the host", setup: () => { m.user = host; }, label: "You're hosting", primary: 0 },
  ];

  it.each(scenarios)("$name: $label, with $primary primary button(s) in the whole page", async ({ setup, label, primary }) => {
    setup();
    await draw();
    expect(primaryButtons()).toHaveLength(primary);
    if (primary) expect(primaryButtons()[0]).toHaveTextContent(label);
    else expect(bookingState()).toBe(label);
    // "Booking-shaped" buttons: nothing else on the page is named like the booking control.
    expect(screen.queryAllByRole("button", { name: /^(I'm Going|Going|Waitlist|Sold out|Ended)$/ })).toHaveLength(primary);
  });

  it("walks Join, confirmed, Cancel as one control, with one message at each step and no toast", async () => {
    m.user = viewer;
    m.rpc.mockImplementation(async (name: string) => {
      if (name === "cancel_event_rsvp") { m.participation = null; m.going = 3; return { data: "cancelled", error: null }; }
      m.participation = "going"; m.going = 4; return { data: "joined", error: null };
    });
    await draw();

    // Join
    fireEvent.click(screen.getByRole("button", { name: "I'm Going" }));
    expect(await screen.findByText("You're going. Your place is confirmed.")).toBeInTheDocument();
    // Confirmed: the control reads what the server stored, and the count is the server's.
    await waitFor(() => expect(bookingState()).toBe("Going"));
    expect(primaryButtons()).toHaveLength(0);
    expect(occurrences(/4 going/)).toBe(1);
    expect(m.rpc).toHaveBeenCalledWith("rsvp_to_event", expect.objectContaining({ p_event_id: "e1" }));
    expect(m.rpc.mock.calls.filter(([name]) => name === "rsvp_to_event")).toHaveLength(1);
    // The confirmation email is requested once, for the row the server stored.
    expect(sendEventConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(sendEventConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ eventId: "e1", participantId: "p1" }));
    // No second success surface: no toast, no dialog.
    expect(m.toast).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(occurrences(/You're in/)).toBe(0);

    // Cancel: one confirmation, then the resulting state.
    fireEvent.click(screen.getByRole("button", { name: "Cancel RSVP" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, cancel RSVP" }));
    expect(await screen.findByText("Your RSVP is cancelled. Your spot has been released.")).toBeInTheDocument();
    expect(screen.queryByText("You're going. Your place is confirmed.")).not.toBeInTheDocument();
    await waitFor(() => expect(primaryButtons()).toHaveLength(1));
    expect(primaryButtons()[0]).toHaveTextContent("I'm Going");
    expect(occurrences(/3 going/)).toBe(1);
    expect(m.toast).not.toHaveBeenCalled();
    expect(sendEventConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it("still sends the confirmation email when the first read of the new RSVP row fails: it reads once more", async () => {
    m.user = viewer;
    m.rpc.mockImplementation(async () => { m.participation = "going"; m.ownRowReadFailures = 1; return { data: "joined", error: null }; });
    await draw();
    fireEvent.click(screen.getByRole("button", { name: "I'm Going" }));

    expect(await screen.findByText("You're going. Your place is confirmed.")).toBeInTheDocument();
    await waitFor(() => expect(sendEventConfirmationEmail).toHaveBeenCalledTimes(1));
    expect(sendEventConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ eventId: "e1", participantId: "p1", eventTitle: "Studio Night" }));
  });

  it("does not send a second confirmation email to a member who was already going", async () => {
    m.user = viewer;
    m.rpc.mockImplementation(async () => { m.participation = "going"; return { data: "already", error: null }; });
    await draw();
    fireEvent.click(screen.getByRole("button", { name: "I'm Going" }));

    expect(await screen.findByText("You're already on the guest list.")).toBeInTheDocument();
    expect(sendEventConfirmationEmail).not.toHaveBeenCalled();
  });

  it("tells what the server stored, not what the call answered: a join stored as a waitlist place reads as waitlisted", async () => {
    m.user = viewer;
    m.rpc.mockImplementation(async () => { m.participation = "waitlisted"; return { data: "joined", error: null }; });
    await draw();
    fireEvent.click(screen.getByRole("button", { name: "I'm Going" }));

    expect(await screen.findByText(/You're on the waitlist/)).toBeInTheDocument();
    await waitFor(() => expect(bookingState()).toBe("Waitlisted"));
    expect(screen.queryByText(/You're going/)).not.toBeInTheDocument();
    expect(sendEventConfirmationEmail).not.toHaveBeenCalled();
  });

  it("says a full event refused the join, and does not show the member as going", async () => {
    m.user = viewer;
    m.rpc.mockResolvedValue({ data: "full_no_waitlist", error: null });
    await draw();
    fireEvent.click(screen.getByRole("button", { name: "I'm Going" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This event is full");
    expect(bookingState()).toBeNull();
    expect(primaryButtons()).toHaveLength(1);
    expect(m.toast).not.toHaveBeenCalled();
  });

  it("sends a visitor who needs an account to sign in instead of booking", async () => {
    m.event = { ...baseEvent(), require_account_for_rsvp: true };
    await draw();
    fireEvent.click(screen.getByRole("button", { name: "I'm Going" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toMatch(/^\/auth/));
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("shows the guest's confirmed landing as the same one message, takes their details out of the address, and dismisses it", async () => {
    render(
      <MemoryRouter initialEntries={["/event/e1?rsvp=confirmed&name=Ari&email=ari%40example.com&token=11111111111111111111111111111111"]}>
        <Routes>
          <Route path="/event/:eventId" element={<><EventPage /><Where /></>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Studio Night" });
    expect(await screen.findByText("You're going. We're sending a confirmation to ari@example.com.")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-rsvp-notice]")).toHaveLength(1);
    // The address no longer carries the guest's name, email or pass token: it is the plain link to the event, safe to copy or share.
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/event/e1"));
    // …and the message is still there after the address changed.
    expect(screen.getByText("You're going. We're sending a confirmation to ari@example.com.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    await waitFor(() => expect(document.querySelectorAll("[data-rsvp-notice]")).toHaveLength(0));
  });

  it("words the landing from the confirmation email as attendance confirmed, by name", async () => {
    render(
      <MemoryRouter initialEntries={["/event/e1?rsvp=confirmed&source=email&name=Ari"]}>
        <Routes>
          <Route path="/event/:eventId" element={<><EventPage /><Where /></>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Studio Night" });
    expect(await screen.findByText("Attendance confirmed. Great to have you, Ari. Your spot is locked in.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/event/e1"));
  });
});

describe("Event page: who is going", () => {
  const rows = [{ id: "1", user_id: "u1", guest_name: null, joined_at: "2026-11-01T10:00:00Z" }, { id: "2", user_id: "u2", guest_name: null, joined_at: "2026-11-02T10:00:00Z" }];
  const profiles = [{ user_id: "u1", full_name: "Ari Stone", avatar_url: null, role: "Producer" }, { user_id: "u2", full_name: "Bea Moon", avatar_url: null, role: "Director" }];

  it("draws avatar circles in the booking block, and the stack opens the list whose rows open public Passports", async () => {
    m.participantRows = rows;
    m.profileRows = profiles;
    m.going = 2;
    await draw();

    const stack = await screen.findByRole("button", { name: /2 going: Ari Stone, Bea Moon\. View everyone going\./ });
    expect(document.getElementById("event-booking")).toContainElement(stack);
    fireEvent.click(stack);
    const dialog = await screen.findByRole("dialog", { name: "Who's going" });
    const link = await within(dialog).findByRole("link", { name: /Bea Moon/ });
    expect(link).toHaveAttribute("href", "/epk/u2");
    fireEvent.click(link);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/epk/u2"));
  });

  it("keeps the avatars and the list from a visitor when the host keeps the guest list private, and still says how many", async () => {
    m.event = { ...baseEvent(), attendee_list_visibility: "host_only" };
    m.participantRows = rows;
    m.profileRows = profiles;
    m.going = 2;
    await draw();

    expect(await screen.findByText("2 going")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View everyone going/ })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Ari Stone");
  });

  it("shows the same list to a member who has a place, even when the host keeps it private", async () => {
    m.user = viewer;
    m.participation = "going";
    m.event = { ...baseEvent(), attendee_list_visibility: "host_only" };
    m.participantRows = rows;
    m.profileRows = profiles;
    m.going = 2;
    await draw();
    expect(await screen.findByRole("button", { name: /View everyone going/ })).toBeInTheDocument();
  });

  it("keeps a guest RSVP in the list, by the name they gave and with no link", async () => {
    m.participantRows = [...rows, { id: "3", user_id: null, guest_name: "Cleo Guest", joined_at: "2026-11-03T10:00:00Z", is_visible: true }];
    m.profileRows = profiles;
    m.going = 3;
    await draw();

    fireEvent.click(await screen.findByRole("button", { name: /View everyone going/ }));
    const dialog = await screen.findByRole("dialog", { name: "Who's going" });
    const guest = (await within(dialog).findByText("Cleo Guest")).closest("li")!;
    expect(guest).toHaveTextContent("Guest RSVP");
    expect(within(guest).queryByRole("link")).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
  });

  it("keeps a member who hid themselves from the attendee list out of the avatars and out of the list, for a visitor", async () => {
    m.participantRows = [...rows, { id: "3", user_id: "u3", guest_name: null, joined_at: "2026-11-03T10:00:00Z", is_visible: false }];
    m.profileRows = [...profiles, { user_id: "u3", full_name: "Hid Den", avatar_url: null, role: "Editor" }];
    m.going = 3;
    await draw();

    // Three are going (the server's count), two are named: the hidden member is in the count only.
    const stack = await screen.findByRole("button", { name: /View everyone going/ });
    expect(stack).toHaveAccessibleName("3 going: Ari Stone, Bea Moon and 1 more. View everyone going.");
    fireEvent.click(stack);
    const dialog = await screen.findByRole("dialog", { name: "Who's going" });
    await within(dialog).findByRole("link", { name: /Ari Stone/ });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("Hid Den");
  });

  it("shows the host that member, marked as hidden from other attendees", async () => {
    m.user = host;
    m.participantRows = [...rows, { id: "3", user_id: "u3", guest_name: null, joined_at: "2026-11-03T10:00:00Z", is_visible: false }];
    m.profileRows = [...profiles, { user_id: "u3", full_name: "Hid Den", avatar_url: null, role: "Editor" }];
    m.going = 3;
    await draw();

    fireEvent.click(await screen.findByRole("button", { name: /View everyone going/ }));
    const dialog = await screen.findByRole("dialog", { name: "Who's going" });
    const hidden = (await within(dialog).findByText("Hid Den")).closest("li")!;
    expect(hidden).toHaveTextContent("Hidden from other attendees");
  });

  it("says nobody has joined yet instead of 0 going", async () => {
    m.going = 0;
    await draw();
    expect(await screen.findByText("Be the first to join.")).toBeInTheDocument();
    expect(occurrences(/0 going/)).toBe(0);
  });
});

// The same one-line time the block prints; computed here so the test does not repeat the format.
function formatEventTimeForTest(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}
