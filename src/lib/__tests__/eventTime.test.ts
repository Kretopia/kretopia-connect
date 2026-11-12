import { describe, expect, it } from "vitest";
import { eventLocalToUtc, eventUtcToLocal, eventSchedule, getEventTiming, formatEventTime, validEventTimeZone } from "../eventTime";
import { getEventBookingState } from "../eventBookingState";

const schedule = eventSchedule("2026-11-12T18:00", "2026-11-12T20:00", "Asia/Makassar");

describe("Events timezone scheduling", () => {
  it("saves 6 PM Bali as 10 AM UTC on the same day", () => {
    expect(schedule).toEqual({ start_time: "2026-11-12T10:00:00.000Z", end_time: "2026-11-12T12:00:00.000Z", timezone: "Asia/Makassar" });
  });
  it("reopens the original local start and end without shifting them", () => {
    expect(eventUtcToLocal(schedule.start_time, schedule.timezone)).toBe("2026-11-12T18:00");
    expect(eventUtcToLocal(schedule.end_time || "", schedule.timezone)).toBe("2026-11-12T20:00");
  });
  it("keeps booking available before the actual UTC start", () => {
    const timing = getEventTiming(schedule, Date.parse("2026-11-12T06:45:00Z"));
    expect(timing).toEqual({ valid: true, ended: false, active: false, upcoming: true });
    expect(getEventBookingState({ loading: false, availabilityReady: timing.valid, cancelled: false, ended: timing.ended, hosting: false, participation: null, full: false, waitlistEnabled: false, authenticated: false, nativePaid: false })).toBe("available");
  });
  it("becomes active exactly at 6 PM Bali, not ended", () => {
    expect(getEventTiming(schedule, Date.parse("2026-11-12T10:00:00Z"))).toEqual({ valid: true, ended: false, active: true, upcoming: false });
  });
  it("ends only at the configured UTC end", () => {
    expect(getEventTiming(schedule, Date.parse("2026-11-12T11:59:59Z")).ended).toBe(false);
    expect(getEventTiming(schedule, Date.parse("2026-11-12T12:00:00Z")).ended).toBe(true);
  });
  it("does not invent an end when a legacy event has none", () => {
    expect(getEventTiming({ start_time: schedule.start_time }, Date.parse("2026-11-12T11:00:00Z")).active).toBe(true);
  });
  it("retains explicit host completion", () => {
    expect(getEventTiming({ ...schedule, status: "completed" }, Date.parse("2026-11-12T11:00:00Z")).ended).toBe(true);
  });
  it("rejects an end equal to or before the selected local start", () => {
    for (const end of ["2026-11-12T18:00", "2026-11-12T17:59"]) {
      expect(() => eventSchedule("2026-11-12T18:00", end, "Asia/Makassar")).toThrow("End must be after start");
    }
  });
  it("displays event time and offset independently of viewer timezone", () => {
    expect(formatEventTime(schedule.start_time, schedule.timezone)).toMatch(/6:00.*GMT\+8/);
    expect(validEventTimeZone(null)).toBe("UTC");
  });
  it("uses the scheduling date's daylight-saving offset", () => {
    expect(eventLocalToUtc("2026-07-12T18:00", "America/New_York")).toBe("2026-07-12T22:00:00.000Z");
    expect(eventLocalToUtc("2026-11-12T18:00", "America/New_York")).toBe("2026-11-12T23:00:00.000Z");
  });
  it("rejects nonexistent and ambiguous daylight-saving wall times", () => {
    expect(() => eventLocalToUtc("2026-03-08T02:30", "America/New_York")).toThrow("does not exist");
    expect(() => eventLocalToUtc("2026-11-01T01:30", "America/New_York")).toThrow("occurs twice");
  });
});