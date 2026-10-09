import { describe, expect, it } from "vitest";
import { LIVE_STALE_MS, degradedNote, describeScan, friendlyScanError, isScanStale } from "../scoutScan";

const NOW = Date.parse("2026-10-09T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("isScanStale", () => {
  it("is stale when there has never been a scan or the date is unreadable", () => {
    expect(isScanStale(null, NOW)).toBe(true);
    expect(isScanStale(undefined, NOW)).toBe(true);
    expect(isScanStale("not a date", NOW)).toBe(true);
  });

  it("is fresh inside the window and stale after it", () => {
    expect(isScanStale(ago(5 * 60_000), NOW)).toBe(false);
    expect(isScanStale(ago(LIVE_STALE_MS + 1_000), NOW)).toBe(true);
  });
});

describe("friendlyScanError", () => {
  it("turns the old 'Scout not configured' 500 into something a person can act on", () => {
    const msg = friendlyScanError("Scout not configured");
    expect(msg).not.toMatch(/not configured$/);
    expect(msg).toMatch(/open gigs on Kretopia/i);
  });

  it("never shows raw JSON and has a fallback for nothing", () => {
    expect(friendlyScanError('{"error":"boom"}')).toBe("The scan could not complete. Try again in a moment.");
    expect(friendlyScanError("")).toBe("The scan could not complete. Try again in a moment.");
    expect(friendlyScanError(undefined)).toBe("The scan could not complete. Try again in a moment.");
  });

  it("keeps messages that already read well", () => {
    expect(friendlyScanError("Daily limit reached for this feature (5/5). Come back tomorrow.")).toMatch(/Daily limit reached/);
    expect(friendlyScanError("Unauthorized")).toBe("Sign in again to run Scout.");
    expect(friendlyScanError("Profile not found")).toBe("Profile not found");
  });
});

describe("degradedNote", () => {
  it("says what was unavailable, and stays silent when nothing was", () => {
    expect(degradedNote([])).toBeNull();
    expect(degradedNote(undefined)).toBeNull();
    expect(degradedNote(["ai_unavailable"])).toBeNull();
    expect(degradedNote(["web_search_unavailable"])).toMatch(/remote job boards/);
    expect(degradedNote(["web_search_unavailable", "feeds_unavailable"])).toMatch(/didn't answer/);
  });
});

describe("describeScan", () => {
  it("announces new gigs, manual or automatic", () => {
    expect(describeScan({ inserted: 3, filtered: 12, queries: 8 }, true)?.title).toBe("Found 3 new gigs");
    expect(describeScan({ inserted: 1, filtered: 1, queries: 1 }, false)?.title).toBe("Found 1 new gig");
  });

  it("stays quiet for an automatic scan with nothing new, and a skipped one", () => {
    expect(describeScan({ inserted: 0, filtered: 9 }, true)).toBeNull();
    expect(describeScan({ skipped: "recent" }, false)).toBeNull();
    expect(describeScan(null, false)).toBeNull();
  });

  it("answers a manual scan with nothing new honestly", () => {
    expect(describeScan({ inserted: 0, filtered: 9 }, false)?.title).toBe("No new gigs");
    expect(describeScan({ inserted: 0, filtered: 0 }, false)?.title).toBe("No fresh gigs matched right now");
  });

  it("reports the weekly limit", () => {
    expect(describeScan({ gated: true, message: "Free tier: 1 Scout preview per week." }, true)?.title).toBe("Weekly Scout limit reached");
  });
});
