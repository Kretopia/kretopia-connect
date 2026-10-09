import { describe, expect, it } from "vitest";
import { activityFreshness, approvalFacts, gigFacts, passportFacts, taskFacts } from "../today.facts";
import type { TodayTask } from "../today.types";

const NOW = new Date("2026-10-09T12:00:00Z");
const task = (id: string, projectId: string, dueDate: string, overdue = false): TodayTask => ({
  id, title: `Task ${id}`, projectId, projectTitle: `Project ${projectId}`, dueDate, overdue,
});

describe("passportFacts", () => {
  it("names a standing only when the profile has one, else says where the Passport is", () => {
    expect(passportFacts({ tier: "industry", location: null, missingFields: [], waitingForCoSign: 0 }).status).toBe("Industry Verified");
    expect(passportFacts({ tier: null, location: null, missingFields: [], waitingForCoSign: 0 }).status).toBe("Ready to share");
    expect(passportFacts({ tier: "gold", location: null, missingFields: ["Bio"], waitingForCoSign: 0 }).status).toBe("In progress");
  });

  it("only lists facts that exist", () => {
    expect(passportFacts({ tier: null, location: "Paris, France", missingFields: [], waitingForCoSign: 2 }).facts).toEqual(["Paris, France", "2 credits awaiting co-sign"]);
    expect(passportFacts({ tier: null, location: "  ", missingFields: [], waitingForCoSign: 1 }).facts).toEqual(["1 credit awaiting co-sign"]);
    expect(passportFacts({ tier: null, location: null, missingFields: [], waitingForCoSign: 0 }).facts).toEqual([]);
  });

  it("says what to add next", () => {
    expect(passportFacts({ tier: null, location: null, missingFields: ["Bio", "Location", "Skills"], waitingForCoSign: 0 }).reason).toBe("Next to add: Bio · Location");
  });
});

describe("taskFacts", () => {
  it("counts days past due and does not repeat 'due today'", () => {
    expect(taskFacts(task("a", "p", "2026-10-07", true), [], "2026-10-09")).toMatchObject({ status: "Overdue", reason: "2 days past its due date" });
    expect(taskFacts(task("a", "p", "2026-10-08", true), [], "2026-10-09").reason).toBe("1 day past its due date");
    expect(taskFacts(task("a", "p", "2026-10-09"), [], "2026-10-09")).toMatchObject({ status: "Due today", reason: null });
  });

  it("separates other tasks in the same project from the rest of the week", () => {
    const t = task("a", "p1", "2026-10-09");
    const info = taskFacts(t, [t, task("b", "p1", "2026-10-10"), task("c", "p2", "2026-10-11"), task("d", "p3", "2026-10-12")], "2026-10-09");
    expect(info.facts).toEqual(["1 other task due this week in this project", "2 tasks due this week elsewhere"]);
  });

  it("has no facts when nothing else is due", () => {
    const t = task("a", "p1", "2026-10-09");
    expect(taskFacts(t, [t], "2026-10-09").facts).toEqual([]);
  });
});

describe("approvalFacts", () => {
  it("dates the suggestion from its real timestamp, or not at all", () => {
    const two = new Date(NOW.getTime() - 2 * 3_600_000).toISOString();
    expect(approvalFacts({ id: "a", title: "t", body: "b", href: null, createdAt: two }, 1, NOW).freshness).toBe("Suggested 2 hours ago");
    expect(approvalFacts({ id: "a", title: "t", body: "b", href: null }, 1, NOW).freshness).toBeNull();
  });

  it("counts only the others waiting", () => {
    expect(approvalFacts({ id: "a", title: "t", body: "b", href: null }, 1, NOW).facts).toEqual([]);
    expect(approvalFacts({ id: "a", title: "t", body: "b", href: null }, 3, NOW).facts).toEqual(["2 more suggestions waiting"]);
  });
});

describe("gigFacts", () => {
  const base = { id: "g", title: "Colorist", company: "Nord" };

  it("uses the posting's own date, the fit score and the pay it states", () => {
    const info = gigFacts({ ...base, remote: true, fitScore: 87.6, sourceName: "Remote OK", compensation: "$60k / year", postedAt: new Date(NOW.getTime() - 86_400_000).toISOString() }, NOW);
    expect(info.status).toBe("Fresh call · Remote OK");
    expect(info.freshness).toBe("Posted 1 day ago");
    expect(info.facts).toEqual(["Remote", "88% fit with your Passport", "$60k / year"]);
  });

  it("says 'found' when the page gave no posted date, and never invents what is missing", () => {
    const info = gigFacts({ ...base, scoutedAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString() }, NOW);
    expect(info.status).toBe("Fresh call");
    expect(info.freshness).toBe("Found 3 hours ago");
    expect(info.facts).toEqual(["Pay not listed"]);
    expect(gigFacts(base, NOW).freshness).toBeNull();
  });

  it("shows a place for an on-site gig", () => {
    expect(gigFacts({ ...base, location: "Lyon", remote: false }, NOW).facts[0]).toBe("Lyon");
  });
});

describe("activityFreshness", () => {
  it("is from when the signals were really loaded", () => {
    expect(activityFreshness(null, NOW)).toBeNull();
    expect(activityFreshness(NOW.getTime() - 10_000, NOW)).toBe("Updated just now");
    expect(activityFreshness(NOW.getTime() - 5 * 60_000, NOW)).toBe("Updated 5 minutes ago");
  });
});
