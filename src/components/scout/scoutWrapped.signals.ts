import type { ScoutActionRow, ScoutedGig, ScoutTab } from "./scout.types";

/**
 * Scout priority signals: which one to three facts about this person's own
 * Scout list are worth a line at the top of the page.
 *
 * It decides what to SAY, not what to RANK. The results keep the order the
 * existing ranking gives them; nothing here reorders, scores or hides a gig.
 * Every number is a count of rows that exist (gigs on the list, actions this
 * person took), and a fact with nothing behind it is left out, never shown as
 * a zero.
 *
 * Priority, fixed and the same on every visit:
 *   1. a closing date the listing itself gave, within 7 days
 *   2. applications started (apply clicked or a letter drafted) not marked applied
 *   3. saved gigs with nothing started
 *   4. applied, and no outcome recorded yet
 *   5. gigs Scout found in the last 24 hours
 *   6. everything else: gigs on the list
 */
export type ScoutSignalId = "closing" | "started" | "saved" | "awaiting" | "fresh" | "listed";

export interface ScoutSignal {
  id: ScoutSignalId;
  value: number;
  label: string;
  hint: string;
  /** The tab that shows what the number counts. */
  tab: ScoutTab;
}

export interface ScoutSignalInput {
  /** The For You list as shown: dismissed and empty-shell listings already out. */
  gigs: Pick<ScoutedGig, "id" | "scouted_at" | "deadline">[];
  actions: ScoutActionRow[];
  now?: Date;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const CLOSING_WINDOW_DAYS = 7;
export const FRESH_WINDOW_HOURS = 24;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const idsWhere = (actions: ScoutActionRow[], test: (a: ScoutActionRow) => boolean): Set<string> =>
  new Set(actions.filter(test).map((a) => a.scouted_gig_id));

export function selectScoutWrappedSignals({ gigs, actions, now = new Date() }: ScoutSignalInput, max = 3): ScoutSignal[] {
  const t = now.getTime();

  const applied = idsWhere(actions, (a) => a.action === "applied");
  const started = idsWhere(actions, (a) => a.action === "apply_clicked" || a.action === "drafted");
  for (const id of applied) started.delete(id);
  const saved = idsWhere(actions, (a) => a.action === "saved");
  for (const id of applied) saved.delete(id);
  for (const id of started) saved.delete(id);
  // still waiting on a result: applied, and the outcome was never set to won, lost or ghosted
  const awaiting = idsWhere(actions, (a) => a.action === "applied" && (a.outcome == null || a.outcome === "pending"));

  const closing = gigs.filter((g) => {
    if (!g.deadline || applied.has(g.id)) return false;
    const due = Date.parse(g.deadline);
    return Number.isFinite(due) && due >= t && due - t <= CLOSING_WINDOW_DAYS * DAY_MS;
  }).length;

  const fresh = gigs.filter((g) => {
    const found = Date.parse(g.scouted_at);
    return Number.isFinite(found) && found <= t && t - found <= FRESH_WINDOW_HOURS * HOUR_MS;
  }).length;

  const candidates: ScoutSignal[] = [
    {
      id: "closing",
      value: closing,
      label: plural(closing, "gig closes within 7 days", "gigs close within 7 days"),
      hint: "Date from the listing",
      tab: "scouted",
    },
    {
      id: "started",
      value: started.size,
      label: plural(started.size, "application started", "applications started"),
      hint: "Not marked applied yet",
      tab: "scouted",
    },
    {
      id: "saved",
      value: saved.size,
      label: plural(saved.size, "gig saved to review", "gigs saved to review"),
      hint: "In your shortlist",
      tab: "shortlist",
    },
    {
      id: "awaiting",
      value: awaiting.size,
      label: plural(awaiting.size, "application awaiting an outcome", "applications awaiting an outcome"),
      hint: "Mark Won, Lost or Ghosted",
      tab: "scouted",
    },
    {
      id: "fresh",
      value: fresh,
      label: plural(fresh, "gig found in the last 24 h", "gigs found in the last 24 h"),
      hint: "Checked by Scout",
      tab: "scouted",
    },
    {
      id: "listed",
      value: gigs.length,
      label: plural(gigs.length, "gig on your list", "gigs on your list"),
      hint: "From the job boards",
      tab: "scouted",
    },
  ];

  return candidates.filter((c) => c.value > 0).slice(0, max);
}
