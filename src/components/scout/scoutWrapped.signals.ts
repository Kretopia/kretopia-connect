import type { ScoutActionRow, ScoutedGig, ScoutTab } from "./scout.types";

/**
 * Scout priority signals: which one to three facts about this person's own
 * Scout list are worth a line at the top of the page.
 *
 * It decides what to SAY, not what to RANK. The results keep the order the
 * existing ranking gives them; nothing here reorders, scores or hides a gig.
 * Every number is a count of rows that exist (gigs on the list, actions this
 * person took, fields on their Passport), and a fact with nothing behind it is
 * left out, never shown as a zero.
 *
 * Priority, fixed and the same on every visit. People first, then the list:
 *   1. a closing date the listing itself gave, within 7 days
 *   2. applications started (apply clicked or a letter drafted), not marked applied
 *   3. gigs saved to review, nothing started
 *   4. applied, and no outcome recorded yet
 *   5. gigs the board itself dated in the last 7 days
 *   6. gig titles that name the role on the person's Passport
 *   7. gigs in the city on the person's Passport
 *   8. gigs Scout found in the last 24 hours
 *   9. everything else: gigs on the list
 *
 * Groups 2 to 4 are the ones that need a decision from the person, so they sit
 * above anything that is merely news.
 */
export type ScoutSignalId =
  | "closing"
  | "started"
  | "saved"
  | "awaiting"
  | "posted"
  | "role"
  | "place"
  | "fresh"
  | "listed";

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
  gigs: Pick<ScoutedGig, "id" | "scouted_at" | "deadline" | "posted_at" | "title" | "location">[];
  actions: ScoutActionRow[];
  /** The person's Passport, only the two fields this reads. Either may be missing. */
  profile?: { role?: string | null; location?: string | null } | null;
  now?: Date;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const CLOSING_WINDOW_DAYS = 7;
export const POSTED_WINDOW_DAYS = 7;
export const FRESH_WINDOW_HOURS = 24;
/** Shorter than this and a role or a city is too likely to be a fragment of another word. */
const MIN_TERM = 4;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const idsWhere = (actions: ScoutActionRow[], test: (a: ScoutActionRow) => boolean): Set<string> =>
  new Set(actions.filter(test).map((a) => a.scouted_gig_id));

const norm = (text: string | null | undefined) => (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** The first part of "Paris, France": the city. */
export const cityOf = (location: string | null | undefined): string => norm((location ?? "").split(",")[0]);

export function selectScoutWrappedSignals({ gigs, actions, profile, now = new Date() }: ScoutSignalInput, max = 3): ScoutSignal[] {
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

  // The board's own date, when it gave one. A gig with no `posted_at` is simply not counted here.
  const posted = gigs.filter((g) => {
    if (!g.posted_at) return false;
    const at = Date.parse(g.posted_at);
    return Number.isFinite(at) && at <= t && t - at <= POSTED_WINDOW_DAYS * DAY_MS;
  }).length;

  const role = norm(profile?.role);
  const roleHits = role.length >= MIN_TERM ? gigs.filter((g) => norm(g.title).includes(role)).length : 0;

  const city = cityOf(profile?.location);
  const placeHits = city.length >= MIN_TERM ? gigs.filter((g) => norm(g.location).includes(city)).length : 0;

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
      id: "posted",
      value: posted,
      label: plural(posted, "gig posted in the last 7 days", "gigs posted in the last 7 days"),
      hint: "Date given by the board",
      tab: "scouted",
    },
    {
      id: "role",
      value: roleHits,
      label: plural(roleHits, "title names your role", "titles name your role"),
      hint: profile?.role ? `“${profile.role.trim()}” on your Passport` : "",
      tab: "scouted",
    },
    {
      id: "place",
      value: placeHits,
      label: plural(placeHits, "gig in your city", "gigs in your city"),
      hint: profile?.location ? `${(profile.location.split(",")[0] ?? "").trim()} on your Passport` : "",
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
