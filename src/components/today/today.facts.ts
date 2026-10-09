import { formatDistance } from "date-fns";

import { standingLabel } from "@/lib/discoverCreatives";
import { hasRealCompensation } from "@/lib/scoutPay";
import type { TodayApproval, TodayGig, TodayTask } from "./today.types";

/**
 * The supporting facts on Today's cards. Each one is a field that already
 * exists on a row the person is allowed to read (a task's due date, a gig's
 * posted date and fit score, a profile's location); nothing is estimated, and
 * a fact with no data behind it is simply absent. At most three per card.
 */

const ago = (iso: string | null | undefined, now: Date): string | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return formatDistance(new Date(Math.min(t, now.getTime())), now, { addSuffix: true }).replace("about ", "");
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const dayNumber = (isoDate: string) => Math.floor(Date.parse(`${isoDate}T12:00:00Z`) / 86_400_000);

export interface CardFacts {
  /** The state line: a truthful badge and, where meaningful, how fresh it is. */
  status: string;
  freshness: string | null;
  /** Why it matters now, in one line. */
  reason: string | null;
  /** Up to three compact facts. */
  facts: string[];
}

export function passportFacts(input: {
  tier: string | null | undefined;
  location: string | null | undefined;
  missingFields: string[];
  waitingForCoSign: number;
}): CardFacts {
  const standing = standingLabel(input.tier);
  return {
    status: standing ?? (input.missingFields.length === 0 ? "Ready to share" : "In progress"),
    freshness: null,
    reason: input.missingFields.length > 0 ? `Next to add: ${input.missingFields.slice(0, 2).join(" · ")}` : "Your Passport is ready to share.",
    facts: [
      input.location?.trim() || null,
      input.waitingForCoSign > 0 ? `${plural(input.waitingForCoSign, "credit")} awaiting co-sign` : null,
    ].filter((f): f is string => !!f),
  };
}

export function taskFacts(task: TodayTask, deadlines: TodayTask[], today: string): CardFacts {
  const delta = dayNumber(task.dueDate) - dayNumber(today);
  const others = deadlines.filter((d) => d.id !== task.id);
  const sameProject = others.filter((d) => d.projectId === task.projectId).length;
  return {
    status: task.overdue ? "Overdue" : delta === 0 ? "Due today" : "Upcoming",
    freshness: null,
    // "Due today" is already the state line, so it is not said twice
    reason: task.overdue ? `${plural(Math.abs(delta), "day")} past its due date` : delta > 0 ? `Due in ${plural(delta, "day")}` : null,
    facts: [
      sameProject > 0 ? `${plural(sameProject, "other task")} due this week in this project` : null,
      others.length - sameProject > 0 ? `${plural(others.length - sameProject, "task")} due this week elsewhere` : null,
    ].filter((f): f is string => !!f),
  };
}

export function approvalFacts(approval: TodayApproval, approvalCount: number, now: Date = new Date()): CardFacts {
  const when = ago(approval.createdAt, now);
  return {
    status: "Kreto suggests",
    freshness: when ? `Suggested ${when}` : null,
    reason: null,
    facts: approvalCount > 1 ? [`${plural(approvalCount - 1, "more suggestion")} waiting`] : [],
  };
}

export function gigFacts(gig: TodayGig, now: Date = new Date()): CardFacts {
  const posted = ago(gig.postedAt, now);
  const found = ago(gig.scoutedAt, now);
  const place = gig.remote ? "Remote" : gig.location?.trim() || null;
  return {
    status: gig.sourceName ? `Fresh call · ${gig.sourceName}` : "Fresh call",
    freshness: posted ? `Posted ${posted}` : found ? `Found ${found}` : null,
    reason: null,
    facts: [
      place,
      typeof gig.fitScore === "number" ? `${Math.round(gig.fitScore)}% fit with your Passport` : null,
      hasRealCompensation(gig.compensation ?? null) ? gig.compensation! : "Pay not listed",
    ].filter((f): f is string => !!f),
  };
}

/** "Updated 2 minutes ago", from when the signals were really loaded. */
export function activityFreshness(updatedAt: number | null | undefined, now: Date = new Date()): string | null {
  if (!updatedAt) return null;
  const secs = Math.max(0, (now.getTime() - updatedAt) / 1000);
  if (secs < 45) return "Updated just now";
  return `Updated ${formatDistance(new Date(updatedAt), now, { addSuffix: true }).replace("about ", "")}`;
}
