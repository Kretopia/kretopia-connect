import type { AiCreditOverview } from "@/lib/thriveCopilot";

/**
 * What the person has left of Kreto today, read from the server's own numbers (the overview is what the server counts against: a
 * message is checked and reserved there before a model is called). This module only describes that: it can hide nothing and grant
 * nothing, and the server stays the one place the limit is enforced. A person who edits the page still meets the same 429.
 *
 * The day is the server's UTC day, so every allowance resets at 00:00 UTC. The wait is shown in the person's own clock as well.
 */

export interface Meter {
  used: number;
  reserved: number;
  /** What the server allows today. */
  cap: number;
  left: number;
}

export type BlockedBy = "allowance" | "ceiling";

export interface Allowance {
  messages: Meter | null;
  tokens: Meter | null;
  /** The whole service's budget for the day, shared by everyone. */
  ceiling: { left: number; cap: number; pct: number };
  /** Why the next message would be refused, if it would be. */
  blocked: BlockedBy | null;
  /** When the server's day rolls over. */
  resetsAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The next 00:00 UTC after `now`. */
export const nextResetAt = (now: Date = new Date()): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

function meter(row: { used: number; cap: number; reserved: number } | undefined): Meter | null {
  // A negative cap means the server sets none for this feature: there is nothing to count down.
  if (!row || !(row.cap >= 0)) return null;
  return { used: row.used, reserved: row.reserved, cap: row.cap, left: Math.max(0, row.cap - row.used - row.reserved) };
}

export function allowanceFrom(overview: AiCreditOverview | null | undefined, now: Date = new Date()): Allowance | null {
  if (!overview?.envelope || !Array.isArray(overview.mine)) return null;
  const { envelope } = overview;
  const messages = meter(overview.mine.find((m) => m.feature === "kreto_message"));
  const tokens = meter(overview.mine.find((m) => m.feature === "kreto_tokens"));
  const ceilingLeft = Math.max(0, envelope.credits_cap - envelope.credits_used - envelope.credits_reserved);
  const ceiling = { left: ceilingLeft, cap: envelope.credits_cap, pct: envelope.credits_cap > 0 ? Math.round((ceilingLeft / envelope.credits_cap) * 100) : 0 };

  // The reset follows the server's own day when it says which one it is; a stale or missing day falls back to the next UTC midnight.
  const dayStart = typeof envelope.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(envelope.day) ? Date.parse(`${envelope.day}T00:00:00Z`) : Number.NaN;
  const fromDay = Number.isFinite(dayStart) ? new Date(dayStart + DAY_MS) : null;
  const resetsAt = fromDay && fromDay.getTime() > now.getTime() ? fromDay : nextResetAt(now);

  const blocked: BlockedBy | null = messages && messages.left <= 0 ? "allowance" : tokens && tokens.left <= 0 ? "allowance" : envelope.credits_cap > 0 && ceilingLeft <= 0 ? "ceiling" : null;
  return { messages, tokens, ceiling, blocked, resetsAt };
}

/** "5 h 12 min", "12 min", "less than a minute". */
export function formatWait(ms: number): string {
  if (ms < 60_000) return "less than a minute";
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export interface ResetDescription {
  wait: string;
  /** The reset on the person's own clock, e.g. "1:00 AM". */
  local: string;
}

export function describeReset(resetsAt: Date, now: Date = new Date(), timeZone?: string): ResetDescription {
  return {
    wait: formatWait(resetsAt.getTime() - now.getTime()),
    local: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(resetsAt),
  };
}

/** What to tell someone whose next message would be refused, and when it will not be. */
export function blockedExplanation(allowance: Allowance, now: Date = new Date(), timeZone?: string): string {
  const reset = describeReset(allowance.resetsAt, now, timeZone);
  const when = `It resets at midnight UTC, in ${reset.wait} (${reset.local} your time).`;
  if (allowance.blocked === "ceiling") return `Kreto has reached its limit for the whole service today, so it is paused for everyone. ${when}`;
  const m = allowance.messages;
  if (m && m.left <= 0) {
    return m.cap === 0 ? `Kreto messages are not included today. ${when}` : `You've used today's ${m.used} of ${m.cap} Kreto messages. ${when}`;
  }
  return `You've used today's Kreto allowance. ${when}`;
}
