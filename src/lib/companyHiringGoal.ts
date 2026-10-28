/**
 * What a company says it wants to do on Kretopia, kept in the record the rest of the product already
 * reads for "what is this account here to do": profiles.primary_intents (see lib/intents.ts), which the
 * home starter card, the weekly intent card and intent matching already use.
 *
 * Company onboarding asked "What are you looking to do on Kretopia?" with six answers and then saved
 * none of them (and, worse, sent an `onboarding_complete` field that is not a column, so the whole
 * company page failed to save). The answers map onto the canonical intents; the exact wording has no
 * column to live in, so it is not stored (see the PR for the proposed one-column addition).
 *
 * Pure and dependency-free apart from the intent vocabulary, so the page, the workspace actions and the
 * tests share one definition.
 */
import { INTENT_MAX, normalizeIntents, type PrimaryIntent } from "@/lib/intents";

export const HIRING_GOALS = [
  { label: "Find freelance talent for projects", intents: ["hire"] },
  { label: "Build a roster of go-to creators", intents: ["hire"] },
  { label: "Hire full-time creative staff", intents: ["hire"] },
  { label: "Commission specific creative work", intents: ["hire"] },
  { label: "Sponsor / partner with creators", intents: ["collaborate"] },
  // "Other" says nothing the product can act on: it never changes the saved intents.
  { label: "Other", intents: [] },
] as const satisfies readonly { label: string; intents: readonly PrimaryIntent[] }[];

export type HiringGoalLabel = (typeof HIRING_GOALS)[number]["label"];

/** The intents a chosen goal stands for. A missing, blank or unknown value stands for none. */
export function intentsForHiringGoal(goal: unknown): PrimaryIntent[] {
  if (typeof goal !== "string") return [];
  const found = HIRING_GOALS.find((g) => g.label === goal);
  return found ? [...found.intents] : [];
}

/**
 * The saved intents after choosing a goal: the goal's intents first, then whatever the account already
 * had (deduplicated, at most INTENT_MAX). With nothing to add the existing intents are returned as they
 * are, so choosing "Other", clearing the choice or an unknown value never erases anything.
 */
export function mergeGoalIntents(existing: unknown, goal: unknown): PrimaryIntent[] {
  const current = normalizeIntents(existing);
  const added = intentsForHiringGoal(goal);
  if (added.length === 0) return current;
  return Array.from(new Set([...added, ...current])).slice(0, INTENT_MAX);
}

/** Monday of the current week, `YYYY-MM-DD`: the same value WeeklyIntentCard and Onboarding store. */
export function intentWeekStart(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The columns to write for a new set of intents, in the shape the other writers already use, or null when
 * there is nothing to write (so a save without a usable goal leaves the intent columns alone).
 */
export function intentColumnsFor(next: PrimaryIntent[], current: PrimaryIntent[], now: Date = new Date()) {
  if (next.length === 0) return null;
  if (next.length === current.length && next.every((v, i) => v === current[i])) return null;
  return {
    primary_intents: next,
    primary_intent: next[0], // legacy mirror, as Onboarding and WeeklyIntentCard keep it
    intent_set_at: now.toISOString(),
    intent_week_start: intentWeekStart(now),
  };
}

export interface CompanyAction {
  label: string;
  path: string;
}

/** The actions about finding creators: the talent finder, and Discover's Sourced creatives lane. */
const FINDS_CREATORS = (path: string) => path === "/talent-finder" || path.startsWith("/discover?tab=people");

/**
 * The company workspace's actions, in the order that suits what the company said it is here to do:
 * a company that wants to sponsor or partner starts from finding creators, everyone else (hiring, or no
 * saved intent) keeps the existing order. The same actions and targets either way, only the order moves.
 */
export function orderCompanyActions<T extends CompanyAction>(actions: readonly T[], intents: unknown): T[] {
  const first = normalizeIntents(intents)[0];
  if (first !== "collaborate") return [...actions];
  const rank = (a: T) => (FINDS_CREATORS(a.path) ? 0 : 1);
  return [...actions].sort((a, b) => rank(a) - rank(b));
}
