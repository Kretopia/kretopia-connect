// Spending limits for external discovery. Pure helpers; the reservation itself is atomic in the database
// (reserve_discovery_spend / settle_discovery_spend / expire_discovery_spend).
//
// The rule the database enforces: money is RESERVED before an external call, against every scope that applies (the
// global daily ceiling, the source, the user), in one statement that cannot overshoot any of them under concurrency;
// afterwards the real usage is settled and the unused part returns to the budget. An abandoned reservation expires.
// An adapter whose cost is unknown has no price, so it cannot reserve anything and stays disabled.

import type { SourceAdapter } from "./sources.ts";

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Cents for `calls` calls of an adapter, or null when the adapter has no known cost (it must not run). */
export function costCents(adapter: Pick<SourceAdapter, "costPerCallCents">, calls: number): number | null {
  if (adapter.costPerCallCents === null) return null;
  if (!Number.isInteger(calls) || calls < 0) return null;
  return adapter.costPerCallCents * calls;
}

/** The scopes a call is reserved against. A manual import by a user also counts against that user. */
export function scopesFor(args: { sourceId: string; userId?: string | null }): string[] {
  return ["global", `source:${args.sourceId}`, ...(args.userId ? [`user:${args.userId}`] : [])];
}

/** An idempotent job key: the same source, day and slot is the same job, so a retried or overlapping run reuses it. */
export function jobKey(sourceId: string, now: Date, slot: string = "run"): string {
  return `${sourceId}:${utcDay(now)}:${slot}`;
}
