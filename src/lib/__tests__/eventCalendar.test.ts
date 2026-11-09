import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  tables: [] as string[],
  upsert: vi.fn(),
  select: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      m.tables.push(table);
      return {
        upsert: (...args: unknown[]) => m.upsert(...args),
        select: () => ({ eq: () => m.select() }),
        delete: () => ({ eq: () => ({ eq: () => m.del() }) }),
      };
    },
  },
}));

import { addToKretopiaCalendar, fetchCalendarEntries, googleCalendarUrl, isMissingRelation, removeFromKretopiaCalendar } from "../eventCalendar";

const missing = { code: "PGRST205", message: "Could not find the table 'public.event_calendar_entries' in the schema cache" };

beforeEach(() => {
  m.tables.length = 0;
  m.upsert.mockReset().mockResolvedValue({ error: null });
  m.select.mockReset().mockResolvedValue({ data: [], error: null });
  m.del.mockReset().mockResolvedValue({ error: null });
});

describe("the Kretopia calendar is its own list, not attendance", () => {
  it("saving an event writes only to the calendar table: no RSVP, no reservation, no attendee row", async () => {
    const result = await addToKretopiaCalendar("u1", "e1");
    expect(result).toEqual({ ok: true });
    expect(m.tables).toEqual(["event_calendar_entries"]);
    expect(m.tables).not.toContain("jam_participants");
    expect(m.upsert).toHaveBeenCalledWith({ user_id: "u1", event_id: "e1" }, { onConflict: "user_id,event_id", ignoreDuplicates: true });
  });

  it("saving twice is not an error: the event is on the calendar, which is what was asked", async () => {
    expect(await addToKretopiaCalendar("u1", "e1")).toEqual({ ok: true });
    expect(await addToKretopiaCalendar("u1", "e1")).toEqual({ ok: true });
  });

  it("removing an event takes it off the calendar and touches nothing else", async () => {
    expect(await removeFromKretopiaCalendar("u1", "e1")).toEqual({ ok: true });
    expect(m.tables).toEqual(["event_calendar_entries"]);
  });

  it("reads the member's own entries only, as a set of event ids", async () => {
    m.select.mockResolvedValue({ data: [{ event_id: "e1" }, { event_id: "e2" }], error: null });
    const entries = await fetchCalendarEntries("u1");
    expect(entries.available).toBe(true);
    expect([...entries.ids].sort()).toEqual(["e1", "e2"]);
    expect(m.tables).toEqual(["event_calendar_entries"]);
  });

  it("a signed-out visitor can neither save nor remove, and nothing is sent", async () => {
    expect(await addToKretopiaCalendar(null, "e1")).toMatchObject({ ok: false, reason: "signed-out" });
    expect(await removeFromKretopiaCalendar(null, "e1")).toMatchObject({ ok: false, reason: "signed-out" });
    expect(await fetchCalendarEntries(null)).toMatchObject({ available: false });
    expect(m.tables).toEqual([]);
  });

  it("says the calendar is unavailable, not that it worked, while its table does not exist yet", async () => {
    m.upsert.mockResolvedValue({ error: missing });
    m.select.mockResolvedValue({ data: null, error: missing });
    m.del.mockResolvedValue({ error: missing });
    expect(await addToKretopiaCalendar("u1", "e1")).toMatchObject({ ok: false, reason: "unavailable" });
    expect(await removeFromKretopiaCalendar("u1", "e1")).toMatchObject({ ok: false, reason: "unavailable" });
    expect(await fetchCalendarEntries("u1")).toMatchObject({ available: false, error: null });
  });

  it("reports any other failure as a failure with the server's own words", async () => {
    m.upsert.mockResolvedValue({ error: { code: "42501", message: "new row violates row-level security policy" } });
    const result = await addToKretopiaCalendar("u1", "e1");
    expect(result).toMatchObject({ ok: false, reason: "failed", message: "new row violates row-level security policy" });
    m.select.mockResolvedValue({ data: null, error: { code: "08006", message: "connection lost" } });
    expect(await fetchCalendarEntries("u1")).toMatchObject({ available: true, error: "connection lost" });
  });

  it("recognises a missing table however it is reported", () => {
    expect(isMissingRelation({ code: "PGRST205" })).toBe(true);
    expect(isMissingRelation({ code: "42P01" })).toBe(true);
    expect(isMissingRelation({ message: 'relation "public.event_calendar_entries" does not exist' })).toBe(true);
    expect(isMissingRelation({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingRelation(null)).toBe(false);
  });
});

describe("googleCalendarUrl: the external export of the same event", () => {
  const url = (over = {}) => new URL(googleCalendarUrl({ title: "Studio Night", description: "Bring stems.", startTime: "2026-12-05T18:30:00.000Z", endTime: "2026-12-05T21:00:00.000Z", venueName: "Studio Nine", venueAddress: "1 Rue Exemple", url: "https://kretopia.com/event/e1", ...over }));

  it("is a Google Calendar add-event link with the title, the UTC times, the place and the event's page", () => {
    const u = url();
    expect(u.origin + u.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("text")).toBe("Studio Night");
    expect(u.searchParams.get("dates")).toBe("20261205T183000Z/20261205T210000Z");
    expect(u.searchParams.get("location")).toBe("Studio Nine, 1 Rue Exemple");
    expect(u.searchParams.get("details")).toContain("https://kretopia.com/event/e1");
  });

  it("lasts two hours when the event has no end, as the .ics download does", () => {
    expect(url({ endTime: null }).searchParams.get("dates")).toBe("20261205T183000Z/20261205T203000Z");
  });

  it("leaves out the place and details it does not have", () => {
    const u = url({ venueName: null, venueAddress: null, description: null, url: undefined });
    expect(u.searchParams.has("location")).toBe(false);
    expect(u.searchParams.has("details")).toBe(false);
  });
});
