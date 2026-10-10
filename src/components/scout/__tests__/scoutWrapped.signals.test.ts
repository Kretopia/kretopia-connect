import { describe, expect, it } from "vitest";
import { selectScoutWrappedSignals } from "../scoutWrapped.signals";
import type { ScoutActionRow } from "../scout.types";

const NOW = new Date("2026-10-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

const gig = (id: string, over: Record<string, unknown> = {}) => ({ id, title: "A gig", location: null, posted_at: null, scouted_at: hoursAgo(72), deadline: null, ...over });
const act = (scouted_gig_id: string, action: string, outcome: string | null = null): ScoutActionRow => ({ scouted_gig_id, action, outcome });

describe("selectScoutWrappedSignals", () => {
  it("says nothing when there is nothing behind it", () => {
    expect(selectScoutWrappedSignals({ gigs: [], actions: [], now: NOW })).toEqual([]);
  });

  it("never shows a zero: a fact with no rows behind it is left out", () => {
    const out = selectScoutWrappedSignals({ gigs: [gig("a")], actions: [], now: NOW });
    expect(out.map((s) => s.id)).toEqual(["listed"]);
    expect(out.every((s) => s.value > 0)).toBe(true);
  });

  it("keeps a fixed order: the person's decisions first, then the board's dates, their Passport, Scout's own check, then the list", () => {
    const out = selectScoutWrappedSignals(
      {
        gigs: [
          gig("a", { deadline: inDays(3), title: "Senior Motion Designer", location: "Paris, France", posted_at: hoursAgo(30) }),
          gig("b", { scouted_at: hoursAgo(2) }),
          gig("c"),
        ],
        actions: [act("b", "apply_clicked"), act("c", "saved"), act("d", "applied", "pending")],
        profile: { role: "Motion Designer", location: "Paris, France" },
        now: NOW,
      },
      9,
    );
    expect(out.map((s) => s.id)).toEqual(["closing", "started", "saved", "awaiting", "posted", "role", "place", "fresh", "listed"]);
  });

  it("shows at most three, the first three in that order", () => {
    const out = selectScoutWrappedSignals({
      gigs: [gig("a", { deadline: inDays(2) }), gig("b", { scouted_at: hoursAgo(1) })],
      actions: [act("a", "drafted"), act("c", "saved"), act("d", "applied")],
      now: NOW,
    });
    expect(out.map((s) => s.id)).toEqual(["closing", "started", "saved"]);
  });

  it("is stable: the same input gives the same answer, in the same order", () => {
    const input = { gigs: [gig("a", { scouted_at: hoursAgo(3) }), gig("b")], actions: [act("b", "saved")], now: NOW };
    expect(selectScoutWrappedSignals(input)).toEqual(selectScoutWrappedSignals({ ...input, gigs: [...input.gigs].reverse() }));
  });

  it("counts a gig once: applied leaves saved and started, started leaves saved", () => {
    const out = selectScoutWrappedSignals(
      {
        gigs: [],
        actions: [act("a", "saved"), act("a", "drafted"), act("a", "applied", "pending"), act("b", "saved"), act("b", "apply_clicked"), act("c", "saved")],
        now: NOW,
      },
      6,
    );
    const by = Object.fromEntries(out.map((s) => [s.id, s.value]));
    expect(by).toEqual({ started: 1, saved: 1, awaiting: 1 });
  });

  it("an applied gig is only 'awaiting' until an outcome is recorded", () => {
    const resolved = selectScoutWrappedSignals({ gigs: [], actions: [act("a", "applied", "won"), act("b", "applied", "ghosted")], now: NOW });
    expect(resolved).toEqual([]);
    const open = selectScoutWrappedSignals({ gigs: [], actions: [act("a", "applied", "pending"), act("b", "applied", null)], now: NOW });
    expect(open).toMatchObject([{ id: "awaiting", value: 2 }]);
  });

  it("only a deadline the listing gave counts, and only inside seven days", () => {
    const out = selectScoutWrappedSignals(
      {
        gigs: [gig("a", { deadline: inDays(6) }), gig("b", { deadline: inDays(9) }), gig("c", { deadline: inDays(-1) }), gig("d")],
        actions: [],
        now: NOW,
      },
      6,
    );
    expect(out.find((s) => s.id === "closing")).toMatchObject({ value: 1, label: "gig closes within 7 days" });
  });

  it("fresh means found in the last 24 hours, not 'new since you last looked'", () => {
    const out = selectScoutWrappedSignals({ gigs: [gig("a", { scouted_at: hoursAgo(23) }), gig("b", { scouted_at: hoursAgo(25) })], actions: [], now: NOW }, 6);
    expect(out.find((s) => s.id === "fresh")).toMatchObject({ value: 1, hint: "Checked by Scout" });
    expect(JSON.stringify(out)).not.toMatch(/since you|unseen|new for you/i);
  });

  it("'posted' is the board's own date, within 7 days, and a gig with no date is not counted", () => {
    const out = selectScoutWrappedSignals(
      { gigs: [gig("a", { posted_at: hoursAgo(24 * 6) }), gig("b", { posted_at: hoursAgo(24 * 9) }), gig("c", { posted_at: null })], actions: [], now: NOW },
      9,
    );
    expect(out.find((s) => s.id === "posted")).toMatchObject({ value: 1, hint: "Date given by the board" });
  });

  it("role and place come from the Passport's own fields, as plain text matches", () => {
    const gigs = [
      gig("a", { title: "Motion Designer (freelance)", location: "Paris, France" }),
      gig("b", { title: "Video Editor", location: "Lyon" }),
      gig("c", { title: "motion designer", location: "Remote" }),
    ];
    const out = selectScoutWrappedSignals({ gigs, actions: [], profile: { role: "Motion Designer", location: "Paris, France" }, now: NOW }, 9);
    expect(out.find((s) => s.id === "role")).toMatchObject({ value: 2, hint: "“Motion Designer” on your Passport" });
    expect(out.find((s) => s.id === "place")).toMatchObject({ value: 1, hint: "Paris on your Passport" });
  });

  it("without a role or a city on the Passport, those two facts do not exist", () => {
    const gigs = [gig("a", { title: "Motion Designer", location: "Paris" })];
    for (const profile of [null, undefined, {}, { role: "", location: null }, { role: "VJ", location: "NY" }]) {
      const ids = selectScoutWrappedSignals({ gigs, actions: [], profile, now: NOW }, 9).map((s) => s.id);
      expect(ids).not.toContain("role");
      expect(ids).not.toContain("place");
    }
  });

  it("invents no score and no superlative", () => {
    const out = selectScoutWrappedSignals({ gigs: [gig("a", { scouted_at: hoursAgo(1) })], actions: [act("a", "saved")], now: NOW }, 6);
    expect(JSON.stringify(out)).not.toMatch(/%|strongest|best|top match|score/i);
  });

  it("sends each fact to the tab that shows what it counts", () => {
    const out = selectScoutWrappedSignals({ gigs: [gig("a")], actions: [act("s", "saved")], now: NOW }, 6);
    expect(out.find((s) => s.id === "saved")?.tab).toBe("shortlist");
    expect(out.find((s) => s.id === "listed")?.tab).toBe("scouted");
  });
});
