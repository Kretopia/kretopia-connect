import { describe, expect, it } from "vitest";
import {
  HIRING_GOALS,
  intentColumnsFor,
  intentsForHiringGoal,
  intentWeekStart,
  mergeGoalIntents,
  orderCompanyActions,
} from "../companyHiringGoal";
import { INTENTS, INTENT_MAX } from "../intents";

describe("intentsForHiringGoal: each answer stands for a canonical intent", () => {
  it("maps the four hiring answers to hire and sponsoring to collaborate", () => {
    expect(intentsForHiringGoal("Find freelance talent for projects")).toEqual(["hire"]);
    expect(intentsForHiringGoal("Build a roster of go-to creators")).toEqual(["hire"]);
    expect(intentsForHiringGoal("Hire full-time creative staff")).toEqual(["hire"]);
    expect(intentsForHiringGoal("Commission specific creative work")).toEqual(["hire"]);
    expect(intentsForHiringGoal("Sponsor / partner with creators")).toEqual(["collaborate"]);
  });

  it("'Other', blank, unknown and non-string values stand for nothing", () => {
    for (const v of ["Other", "", "  ", "Find freelance talent", "hire", null, undefined, 3, {}]) {
      expect(intentsForHiringGoal(v)).toEqual([]);
    }
  });

  it("only ever produces intents the product knows", () => {
    const known = INTENTS.map((i) => i.id) as string[];
    for (const g of HIRING_GOALS) for (const i of g.intents) expect(known).toContain(i);
  });
});

describe("mergeGoalIntents: choosing, updating, and not erasing", () => {
  it("saves the goal's intent when the account had none (a first save)", () => {
    expect(mergeGoalIntents(null, "Find freelance talent for projects")).toEqual(["hire"]);
    expect(mergeGoalIntents([], "Sponsor / partner with creators")).toEqual(["collaborate"]);
  });

  it("puts the goal first and keeps what the account already said, at most two", () => {
    expect(mergeGoalIntents(["gigs"], "Sponsor / partner with creators")).toEqual(["collaborate", "gigs"]);
    expect(mergeGoalIntents(["gigs", "fund"], "Find freelance talent for projects")).toEqual(["hire", "gigs"]);
    expect(mergeGoalIntents(["gigs", "fund"], "Find freelance talent for projects")).toHaveLength(INTENT_MAX);
  });

  it("does not duplicate an intent the account already has, and moves it to the front on an update", () => {
    expect(mergeGoalIntents(["hire"], "Hire full-time creative staff")).toEqual(["hire"]);
    expect(mergeGoalIntents(["hire", "collaborate"], "Sponsor / partner with creators")).toEqual(["collaborate", "hire"]);
  });

  it("a missing, 'Other', blank or invalid goal changes nothing", () => {
    for (const goal of [undefined, null, "", "Other", "Not a real goal"]) {
      expect(mergeGoalIntents(["gigs"], goal)).toEqual(["gigs"]);
      expect(mergeGoalIntents(null, goal)).toEqual([]);
    }
  });

  it("reads the legacy single value and drops values that are not intents", () => {
    expect(mergeGoalIntents("gigs", "Find freelance talent for projects")).toEqual(["hire", "gigs"]);
    expect(mergeGoalIntents(["gigs", "nonsense", 7], "Other")).toEqual(["gigs"]);
  });
});

describe("intentColumnsFor: what is written", () => {
  const NOW = new Date("2026-10-18T12:00:00Z");

  it("writes the four columns the other writers use, with the legacy mirror", () => {
    expect(intentColumnsFor(["hire", "gigs"], [], NOW)).toEqual({
      primary_intents: ["hire", "gigs"],
      primary_intent: "hire",
      intent_set_at: "2026-10-18T12:00:00.000Z",
      intent_week_start: intentWeekStart(NOW),
    });
  });

  it("writes nothing when there is nothing to save or nothing changed", () => {
    expect(intentColumnsFor([], [], NOW)).toBeNull();
    expect(intentColumnsFor([], ["hire"], NOW)).toBeNull();
    expect(intentColumnsFor(["hire"], ["hire"], NOW)).toBeNull();
  });

  it("an order change is a change", () => {
    expect(intentColumnsFor(["collaborate", "hire"], ["hire", "collaborate"], NOW)?.primary_intent).toBe("collaborate");
  });

  it("intentWeekStart is computed exactly as WeeklyIntentCard and Onboarding compute it, so the weekly card agrees", () => {
    // The formula those two use, copied: local Monday, then the ISO date. It is local-time based on purpose
    // (the card compares against its own computation), so only its agreement and its shape are asserted.
    const reference = (now: Date) => {
      const d = new Date(now);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      return d.toISOString().slice(0, 10);
    };
    for (const t of ["2026-10-12T12:00:00Z", "2026-10-14T12:00:00Z", "2026-10-18T12:00:00Z", "2026-12-31T23:30:00Z", "2027-01-01T00:30:00Z"]) {
      const at = new Date(t);
      expect(intentWeekStart(at)).toBe(reference(at));
      expect(intentWeekStart(at)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("orderCompanyActions: the same actions, ordered for what the company is here to do", () => {
  const actions = [
    { label: "Post a Gig", path: "/post-opportunity" },
    { label: "Review applicants", path: "/opportunity-dashboard" },
    { label: "Find talent", path: "/talent-finder" },
    { label: "Pay creators", path: "/thrivepay" },
  ];
  const paths = (xs: typeof actions) => xs.map((a) => a.path);

  it("keeps the usual order for hiring, for no saved intent and for anything unreadable", () => {
    for (const intents of [["hire"], ["hire", "collaborate"], [], null, undefined, "nonsense"]) {
      expect(paths(orderCompanyActions(actions, intents))).toEqual(paths(actions));
    }
  });

  it("starts from finding talent for a company that wants to sponsor or partner, keeping the rest in order", () => {
    expect(paths(orderCompanyActions(actions, ["collaborate"]))).toEqual([
      "/talent-finder",
      "/post-opportunity",
      "/opportunity-dashboard",
      "/thrivepay",
    ]);
  });

  it("moves Discover's Sourced creatives link up with the talent finder, and leaves Sourced events where it is", () => {
    const withSourced = [
      { label: "Post a Gig", path: "/post-opportunity" },
      { label: "Find talent", path: "/talent-finder" },
      { label: "Sourced creatives", path: "/discover?tab=people&mode=sourced" },
      { label: "Sourced events", path: "/discover?tab=events&mode=sourced" },
      { label: "Pay creators", path: "/thrivepay" },
    ];
    expect(orderCompanyActions(withSourced, ["collaborate"]).map((a) => a.label)).toEqual(["Find talent", "Sourced creatives", "Post a Gig", "Sourced events", "Pay creators"]);
    expect(orderCompanyActions(withSourced, ["hire"]).map((a) => a.label)).toEqual(withSourced.map((a) => a.label));
  });

  it("never adds, drops or retargets an action, and does not mutate its input", () => {
    const before = JSON.stringify(actions);
    const out = orderCompanyActions(actions, ["collaborate"]);
    expect(out).toHaveLength(4);
    expect(new Set(paths(out))).toEqual(new Set(paths(actions)));
    expect(JSON.stringify(actions)).toBe(before);
  });
});
