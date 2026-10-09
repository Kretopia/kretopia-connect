import { describe, expect, it } from "vitest";
import { formatEventWhen, isLive, pickNextEvent, type EventRow } from "../nextEvent";

const NOW = new Date("2026-10-09T12:00:00Z");
const at = (days: number, hours = 0) => new Date(NOW.getTime() + days * 86_400_000 + hours * 3_600_000).toISOString();

const ev = (id: string, start: string, over: Partial<EventRow> = {}): EventRow => ({
  id, title: `Event ${id}`, start_time: start, end_time: null, venue_name: null, category: null, cover_image_url: null, event_mode: null, status: null, ...over,
});

describe("pickNextEvent", () => {
  it("is null when nothing is coming up", () => {
    expect(pickNextEvent([], [], NOW)).toBeNull();
    expect(pickNextEvent([ev("past", at(-1))], [ev("past2", at(0, -1))], NOW)).toBeNull();
  });

  it("takes the earliest upcoming event across hosting and going, and says which it is", () => {
    const next = pickNextEvent([ev("h", at(5))], [ev("g", at(2))], NOW)!;
    expect(next.id).toBe("g");
    expect(next.role).toBe("going");
    expect(pickNextEvent([ev("h", at(1))], [ev("g", at(2))], NOW)!.role).toBe("hosting");
  });

  it("an event the person hosts and also RSVP'd to counts as hosting", () => {
    const next = pickNextEvent([ev("x", at(1))], [ev("x", at(1))], NOW)!;
    expect(next.role).toBe("hosting");
  });

  it("never offers a cancelled or ended event", () => {
    expect(pickNextEvent([ev("c", at(1), { status: "cancelled" })], [ev("e", at(2), { status: "ended" })], NOW)).toBeNull();
    expect(pickNextEvent([ev("c", at(1), { status: "Cancelled" }), ev("ok", at(3), { status: "upcoming" })], [], NOW)!.id).toBe("ok");
    expect(isLive({ status: null })).toBe(true);
  });

  it("keeps the real cover and nothing invented", () => {
    const next = pickNextEvent([ev("a", at(1), { cover_image_url: "https://cdn.example.com/cover.jpg" })], [], NOW)!;
    expect(next.cover_image_url).toBe("https://cdn.example.com/cover.jpg");
    expect(pickNextEvent([ev("b", at(1))], [], NOW)!.cover_image_url).toBeNull();
  });
});

describe("formatEventWhen", () => {
  it("says today, tomorrow, then the date, in the given time zone", () => {
    expect(formatEventWhen("2026-10-09T18:30:00Z", NOW, "en-US", "UTC")).toBe("Today · 6:30 PM");
    expect(formatEventWhen("2026-10-10T09:00:00Z", NOW, "en-US", "UTC")).toBe("Tomorrow · 9:00 AM");
    expect(formatEventWhen("2026-10-17T19:00:00Z", NOW, "en-US", "UTC")).toBe("Sat, Oct 17 · 7:00 PM");
  });

  it("uses the viewer's time zone for 'today'", () => {
    // 23:30 UTC on the 9th is already the 10th in Paris (UTC+2): tomorrow there.
    expect(formatEventWhen("2026-10-09T23:30:00Z", NOW, "en-US", "Europe/Paris")).toBe("Tomorrow · 1:30 AM");
  });

  it("returns nothing for an unreadable date", () => {
    expect(formatEventWhen("not a date", NOW)).toBe("");
  });
});
