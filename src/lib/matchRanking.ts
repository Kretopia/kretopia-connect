/**
 * Match ranking helpers -- pure and deterministic, so the same viewer sees the
 * same order for the same data, and so the rules are testable without a
 * database. Scoring itself (sector / city / past collaboration / skills) stays
 * in matchScoring.ts; this file adds what happens around it: a stable
 * tie-breaker, the signals that need extra data (who already likes you, how
 * recently a profile was updated), the final order, and a light diversity pass.
 *
 * Nothing here invents a candidate or a score: every input is a real profile
 * the viewer is already allowed to see, and every boost is a stated rule.
 */

/** FNV-1a -> [0, 1). Same seed, same number, on every machine and every visit. */
export function stableUnit(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

const STOP = new Set(["and", "the", "for", "with", "from", "that", "this", "your", "you", "are", "des", "les", "une", "pour"]);

/** Loosely-stemmed word set across roles, skills, passions and bio, used for "shared interests". */
export function interestTokens(...parts: unknown[]): Set<string> {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(add);
    if (typeof v === "object") return add((v as { skill?: unknown; name?: unknown }).skill ?? (v as { name?: unknown }).name);
    String(v)
      .toLowerCase()
      .split(/[^a-z0-9à-ÿ]+/)
      .forEach((w) => {
        if (w.length < 3 || STOP.has(w)) return;
        out.add(w.length > 5 ? w.slice(0, 5) : w); // "photographer" ~ "photography"
      });
  };
  parts.forEach(add);
  return out;
}

/** A profile touched in the last two weeks / two months is likelier to answer. */
export function recencyBoost(updatedAt: string | null | undefined, now: number): number {
  if (!updatedAt) return 0;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return 0;
  const days = (now - t) / 86_400_000;
  if (days < 0) return 0;
  if (days <= 14) return 6;
  if (days <= 60) return 3;
  return 0;
}

/**
 * The only profiles the safe, cross-user view can vouch for as real members.
 * The view does not expose `is_claimed`, and imported (unclaimed) profiles are
 * created with `onboarding_completed = true` but never any XP or ID check, so
 * "finished onboarding" alone would let imports into the deck. XP and identity
 * verification can only come from a real account.
 */
export function isPositivelyRealMember(row: { onboarding_completed?: boolean | null; xp?: number | null; id_verified?: boolean | null }): boolean {
  return row.onboarding_completed === true && ((row.xp ?? 0) > 0 || row.id_verified === true);
}

export interface RankableCandidate {
  user_id: string;
  role?: string | null;
  updated_at?: string | null;
  score: number;
}

const byRankThenStable = <T extends RankableCandidate>(a: T, b: T) =>
  b.score - a.score ||
  (Date.parse(b.updated_at ?? "") || 0) - (Date.parse(a.updated_at ?? "") || 0) ||
  (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0);

/**
 * Never shows the same role three times in a row when a different one is
 * waiting a few places down. Only reorders within `window`, so a strong match
 * is never pushed far from where its score put it.
 */
export function diversifyByRole<T extends { role?: string | null }>(sorted: T[], window = 6, maxRun = 2): T[] {
  const pool = [...sorted];
  const out: T[] = [];
  const roleOf = (c: T) => (c.role ?? "").trim().toLowerCase();
  while (pool.length > 0) {
    let pick = 0;
    if (out.length >= maxRun) {
      const tail = out.slice(-maxRun).map(roleOf);
      if (tail.every((r) => r === tail[0])) {
        const alt = pool.slice(0, window).findIndex((c) => roleOf(c) !== tail[0]);
        if (alt > 0) pick = alt;
      }
    }
    out.push(pool.splice(pick, 1)[0]);
  }
  return out;
}

/**
 * Final deck order. Anyone who has already swiped right on you comes first
 * (a swipe back is an instant match, the strongest mutual signal there is),
 * ranked among themselves; everyone else follows by score plus recency, ties
 * broken by freshest profile then id so equal scores never depend on fetch
 * order, then the diversity pass. Everyone passed in comes back out --
 * ranking never filters.
 */
export function orderCandidates<T extends RankableCandidate>(
  items: T[],
  opts: { likedYouIds?: Set<string>; now?: number } = {},
): T[] {
  const now = opts.now ?? Date.now();
  const liked = opts.likedYouIds ?? new Set<string>();
  const scored = items.map((it) => ({ ...it, score: it.score + recencyBoost(it.updated_at, now) }));
  scored.sort(byRankThenStable);
  return [...scored.filter((it) => liked.has(it.user_id)), ...diversifyByRole(scored.filter((it) => !liked.has(it.user_id)))];
}
