import { describe, expect, it } from "vitest";
import { inRetroPeriod, retroPeriod, retroYears, retrospectiveCards, summarizeRetrospective, type RetroCredit } from "../passport/retrospective";

const NOW = new Date("2026-10-21T12:00:00Z");
const credit = (created_at: string | null, over: Partial<RetroCredit> = {}): RetroCredit => ({ created_at, source: "manual", verification_status: "unverified", endorsement_count: 0, ...over });
const summary = (over: Partial<Parameters<typeof summarizeRetrospective>[0]> = {}) =>
  summarizeRetrospective({ year: 2026, credits: [], received: [], given: [], now: NOW, ...over });

describe("period bounds", () => {
  it("is the calendar year in UTC, start inclusive and end exclusive", () => {
    const p = retroPeriod(2026);
    expect(p.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(p.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(inRetroPeriod("2026-01-01T00:00:00.000Z", p)).toBe(true);
    expect(inRetroPeriod("2025-12-31T23:59:59.999Z", p)).toBe(false);
    expect(inRetroPeriod("2026-12-31T23:59:59.999Z", p)).toBe(true);
    expect(inRetroPeriod("2027-01-01T00:00:00.000Z", p)).toBe(false);
  });

  it("never counts a missing or unreadable date, and rejects a nonsense year", () => {
    const p = retroPeriod(2026);
    expect(inRetroPeriod(null, p)).toBe(false);
    expect(inRetroPeriod("", p)).toBe(false);
    expect(inRetroPeriod("not a date", p)).toBe(false);
    expect(() => retroPeriod(Number.NaN)).toThrow(RangeError);
    expect(() => retroPeriod(2026.5)).toThrow(RangeError);
  });

  it("puts a timestamp written in another offset where UTC puts it", () => {
    // 31 Dec 2025, 20:00 in UTC-8 is 1 Jan 2026, 04:00 UTC
    expect(inRetroPeriod("2025-12-31T20:00:00-08:00", retroPeriod(2026))).toBe(true);
  });
});

describe("summary counts", () => {
  it("counts credits added in the period by created_at, not by the year of the work", () => {
    const s = summary({ credits: [credit("2026-02-01T10:00:00Z"), credit("2025-12-31T23:59:59Z"), credit("2026-09-09T09:00:00Z", { source: "youtube" })] });
    expect(s.credits.added).toBe(2);
  });

  it("keeps portfolio pieces out of the credit count and splits them into video, audio and other", () => {
    const s = summary({
      credits: [
        credit("2026-03-01T00:00:00Z", { source: "portfolio", media_type: "video" }),
        credit("2026-03-02T00:00:00Z", { source: "portfolio", media_type: "YouTube" }),
        credit("2026-03-03T00:00:00Z", { source: "portfolio", media_type: "audio" }),
        credit("2026-03-04T00:00:00Z", { source: "portfolio", media_type: "image" }),
        credit("2026-03-05T00:00:00Z", { source: "portfolio", media_type: null }),
        credit("2025-03-05T00:00:00Z", { source: "portfolio", media_type: "video" }),
      ],
    });
    expect(s.credits.added).toBe(0);
    expect(s.media).toEqual({ video: 2, audio: 1, other: 2, total: 5 });
  });

  it("reads each credit's proof from the shared classifier (as of today) and totals the backed ones", () => {
    const s = summary({
      credits: [
        credit("2026-01-10T00:00:00Z", { verification_status: "verified" }),
        credit("2026-01-11T00:00:00Z", { endorsement_count: 2 }),
        credit("2026-01-12T00:00:00Z", { verification_status: "auto_discovered" }),
        credit("2026-01-13T00:00:00Z", { verification_status: "pending" }),
        credit("2026-01-14T00:00:00Z"),
        // a high AI confidence never turns into proof
        credit("2026-01-15T00:00:00Z", { ai_confidence: 0.99 }),
      ],
    });
    expect(s.credits.byEvidence).toEqual({ verified: 1, co_signed: 1, publicly_sourced: 1, pending: 1, self_claimed: 2 });
    expect(s.credits.backed).toBe(2);
  });

  it("counts co-signs by when they were accepted, at the period edges", () => {
    const s = summary({
      received: [{ responded_at: "2026-01-01T00:00:00Z" }, { responded_at: "2025-12-31T23:59:59Z" }, { responded_at: null }],
      given: [{ responded_at: "2026-06-01T00:00:00Z" }],
    });
    expect(s.coSigns).toEqual({ received: 1, given: 1 });
  });

  it("marks only the current year as partial", () => {
    expect(summary({ year: 2026 }).isPartial).toBe(true);
    expect(summary({ year: 2025 }).isPartial).toBe(false);
  });

  it("reports no activity when the period is empty, even if other years are full", () => {
    const s = summary({ year: 2024, credits: [credit("2026-01-01T00:00:00Z")], received: [{ responded_at: "2026-02-01T00:00:00Z" }] });
    expect(s.hasActivity).toBe(false);
    expect(s.credits.added + s.coSigns.received + s.media.total).toBe(0);
  });
});

describe("cards", () => {
  const name = "Maya Laurent";

  it("has only a cover and a closing card when there is nothing to say", () => {
    expect(retrospectiveCards(summary(), name).map((c) => c.kind)).toEqual(["cover", "closing"]);
  });

  it("shows a card per fact that exists, in a fixed order, and none for a zero", () => {
    const s = summary({
      credits: [credit("2026-01-01T00:00:00Z", { verification_status: "verified" }), credit("2026-01-02T00:00:00Z"), credit("2026-04-01T00:00:00Z", { source: "portfolio", media_type: "video" })],
      received: [{ responded_at: "2026-05-01T00:00:00Z" }],
    });
    const cards = retrospectiveCards(s, name);
    expect(cards.map((c) => c.kind)).toEqual(["cover", "credits", "cosigns", "media", "closing"]);
    expect(cards[1]).toMatchObject({ figure: 2, headline: "credits added to your Passport", detail: "1 of them verified or co-signed" });
    expect(cards[2]).toMatchObject({ figure: 1, headline: "co-sign received", detail: null });
    expect(cards[3]).toMatchObject({ figure: 1, headline: "piece of work added", detail: "1 video" });
    expect(retrospectiveCards(summary({ credits: [credit("2026-01-01T00:00:00Z")] }), name).map((c) => c.kind)).toEqual(["cover", "credits", "closing"]);
  });

  it("says nothing about proof when no credit is backed, and 'All' when every one is", () => {
    expect(retrospectiveCards(summary({ credits: [credit("2026-01-01T00:00:00Z")] }), name)[1].detail).toBeNull();
    const all = summary({ credits: [credit("2026-01-01T00:00:00Z", { verification_status: "verified" })] });
    expect(retrospectiveCards(all, name)[1]).toMatchObject({ headline: "credit added to your Passport", detail: "All of them verified or co-signed" });
  });

  it("says 'so far' on the current year only, and falls back to given co-signs", () => {
    expect(retrospectiveCards(summary(), name)[0].headline).toBe("2026 so far");
    expect(retrospectiveCards(summary({ year: 2025 }), name)[0].headline).toBe("2025");
    const gave = retrospectiveCards(summary({ given: [{ responded_at: "2026-03-01T00:00:00Z" }, { responded_at: "2026-03-02T00:00:00Z" }] }), name);
    expect(gave[1]).toMatchObject({ kind: "cosigns", figure: 2, headline: "co-signs given" });
  });

  it("carries only counts and the name: no project title, no collaborator, no score", () => {
    const s = summary({ credits: [credit("2026-01-01T00:00:00Z")], received: [{ responded_at: "2026-05-01T00:00:00Z" }] });
    const text = JSON.stringify(retrospectiveCards(s, name));
    expect(text).not.toMatch(/%|percent|rank|top \d|growth/i);
  });
});

describe("years offered", () => {
  it("runs from the earliest record to the current year, newest first", () => {
    expect(retroYears("2024-05-01T00:00:00Z", NOW)).toEqual([2026, 2025, 2024]);
  });
  it("offers just the current year when nothing is dated, or the earliest is in the future", () => {
    expect(retroYears(null, NOW)).toEqual([2026]);
    expect(retroYears("garbage", NOW)).toEqual([2026]);
    expect(retroYears("2030-01-01T00:00:00Z", NOW)).toEqual([2026]);
  });
});
