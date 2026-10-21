// The draft a person reviews before a New Room project is created from free text, a recording, a file or a sheet.
//
// Two jobs, both pure so they can be tested without the modal:
//  1. normalizeExtractedBrief: extract-brief returns whatever the model wrote (it only checks that `deliverables` is an
//     array). Nothing downstream may trust its types, lengths or dates, so this rebuilds the draft field by field and
//     says what it had to leave out.
//  2. describeDraftOrigin: for every value in the draft, whether the person gave it, Kreto suggested it, or it is still
//     missing, so a suggested budget, date or task is never shown as something the person said.

import { inferPaymentsInvolved } from "@/lib/inferPaymentsInvolved";

/** Longest brief the composer accepts. The function has no cap of its own, so this bounds what one request can cost. */
export const PROJECT_BRIEF_MAX = 4000;

const LIMITS = { title: 120, summary: 2000, taskTitle: 200, taskDescription: 1000, tasks: 8 } as const;
/** The model has no clock: a date this far ahead is a guess, not a plan. */
const MAX_YEARS_AHEAD = 3;

export interface DraftTask {
  title: string;
  description?: string;
  /** ISO date (YYYY-MM-DD), already checked: real, not in the past, not absurdly far. */
  due_date?: string | null;
}

export interface DraftBrief {
  project: { title: string; summary: string };
  deliverables?: DraftTask[];
}

export interface NormalizedBrief {
  brief: DraftBrief;
  /** Tasks left out because they had no readable title or repeated an earlier one. */
  skippedTasks: number;
  /** Due dates left out because they were not real dates, were already past, or were years away. */
  droppedDates: number;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function oneLine(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max).trim() : "";
}

function paragraphs(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(CONTROL, " ").replace(/[ \t]+/g, " ").trim().slice(0, max).trim() : "";
}

/** A usable due date or null. Only an ISO date counts: "next Friday" or "1" parse in some engines and mean nothing. */
function usableDate(value: unknown, now: Date): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const limit = new Date(Date.UTC(now.getUTCFullYear() + MAX_YEARS_AHEAD, now.getUTCMonth(), now.getUTCDate()));
  return parsed < today || parsed > limit ? null : day;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Rebuilds the draft from what extract-brief returned. null when there is no usable project name, so the caller can
 * fall back to the person's own words or show an error instead of an empty draft.
 */
export function normalizeExtractedBrief(raw: unknown, now: Date = new Date()): NormalizedBrief | null {
  if (!isRecord(raw) || !isRecord(raw.project)) return null;
  const title = oneLine(raw.project.title, LIMITS.title);
  if (!title) return null;

  const tasks: DraftTask[] = [];
  const seen = new Set<string>();
  let skippedTasks = 0;
  let droppedDates = 0;

  for (const item of Array.isArray(raw.deliverables) ? raw.deliverables : []) {
    const taskTitle = isRecord(item) ? oneLine(item.title, LIMITS.taskTitle) : "";
    if (!taskTitle || seen.has(taskTitle.toLowerCase())) { skippedTasks += 1; continue; }
    seen.add(taskTitle.toLowerCase());
    if (tasks.length >= LIMITS.tasks) continue;

    const rec = item as Record<string, unknown>;
    const due = usableDate(rec.due_date, now);
    if (rec.due_date != null && rec.due_date !== "" && due === null) droppedDates += 1;
    const description = paragraphs(rec.description, LIMITS.taskDescription);
    tasks.push({ title: taskTitle, ...(description ? { description } : {}), due_date: due });
  }

  return {
    brief: { project: { title, summary: paragraphs(raw.project.summary, LIMITS.summary) }, ...(tasks.length ? { deliverables: tasks } : {}) },
    skippedTasks,
    droppedDates,
  };
}

/** What the person is told about the parts of Kreto's answer that were left out, in the words the review screen shows. */
export function describeLeftOut(skippedTasks: number, droppedDates: number): string[] {
  const notes: string[] = [];
  if (skippedTasks > 0) notes.push(`${skippedTasks} drafted ${skippedTasks === 1 ? "task was" : "tasks were"} left out: no readable title, or a repeat.`);
  if (droppedDates > 0) notes.push(`${droppedDates} suggested due ${droppedDates === 1 ? "date was" : "dates were"} left out: not a real date or not in the future. Kreto doesn't know today's date.`);
  return notes;
}

export type Origin = "you" | "kreto" | "missing";

export interface OriginRow {
  id: string;
  label: string;
  /** What the value is, when it is short enough to show. */
  value?: string;
  /** Missing and the project cannot be created without it. */
  required?: boolean;
}

export interface DraftOrigin {
  you: OriginRow[];
  kreto: OriginRow[];
  missing: OriginRow[];
}

export interface DraftOriginInput {
  title: string;
  summary: string;
  /** Title and summary are the person's own text because Kreto could not structure it, or because they edited them. */
  titleIsYours: boolean;
  summaryIsYours: boolean;
  /** The person's own typed words. Empty for a recording, a file or a sheet: there is nothing to check a value against. */
  rawText: string;
  taskCount: number;
  roomTypeLabel: string;
  roomTypeIsYours: boolean;
  deadline: string;
  deadlineIsSuggested: boolean;
  budget: string;
  budgetIsSuggested: boolean;
  paymentsInvolved: boolean | null;
  paymentsAreSuggested: boolean;
  hasCover: boolean;
}

const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * Where each value of the draft comes from. A suggested budget or money answer only counts as the person's own when the
 * same value is found in their own typed words; for a recording, a file or a sheet there is no text to check, so it
 * stays a suggestion. A value the person typed or tapped is theirs.
 */
export function describeDraftOrigin(i: DraftOriginInput): DraftOrigin {
  const out: DraftOrigin = { you: [], kreto: [], missing: [] };
  const put = (origin: Origin, row: OriginRow) => { out[origin].push(row); };

  const title = i.title.trim();
  if (!title) put("missing", { id: "title", label: "Project name", required: true });
  else put(i.titleIsYours ? "you" : "kreto", { id: "title", label: "Project name" });

  if (!i.summary.trim()) put("missing", { id: "summary", label: "The vision" });
  else put(i.summaryIsYours ? "you" : "kreto", { id: "summary", label: "The vision" });

  if (i.taskCount > 0) put("kreto", { id: "tasks", label: "Starter tasks", value: `${i.taskCount} drafted` });
  else put("missing", { id: "tasks", label: "Starter tasks" });

  put(i.roomTypeIsYours ? "you" : "kreto", { id: "type", label: "Room type", value: i.roomTypeLabel });

  const deadline = i.deadline.trim();
  if (!deadline) put("missing", { id: "deadline", label: "Target date" });
  else put(i.deadlineIsSuggested ? "kreto" : "you", { id: "deadline", label: "Target date", value: deadline });

  const budget = i.budget.trim();
  if (!budget) put("missing", { id: "budget", label: "Budget" });
  else {
    const inTheirWords = i.rawText !== "" && squash(i.rawText).includes(squash(budget));
    put(i.budgetIsSuggested && !inTheirWords ? "kreto" : "you", { id: "budget", label: "Budget", value: budget });
  }

  if (i.paymentsInvolved === null) put("missing", { id: "payments", label: "Money involved", required: true });
  else {
    const inTheirWords = i.rawText !== "" && inferPaymentsInvolved(i.rawText) === i.paymentsInvolved;
    put(i.paymentsAreSuggested && !inTheirWords ? "kreto" : "you", { id: "payments", label: "Money involved", value: i.paymentsInvolved ? "Yes" : "No" });
  }

  if (i.hasCover) put("you", { id: "cover", label: "Cover image" });
  else put("missing", { id: "cover", label: "Cover image", required: true });

  return out;
}
