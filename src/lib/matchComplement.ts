/**
 * Similar is not the same as useful. Two photographers share a craft; a photographer and a stylist,
 * a musician and a filmmaker, a designer and a developer make one piece of work between them. This
 * module says which crafts do that, and which skills a person brings that you do not list.
 *
 * It is a stated product rule over the existing role categories (lib/passport/roleStamp.ts), not data
 * about anyone: it never says two people WILL work well together, only that their crafts are the kind
 * that are usually combined. "creator" is the fallback category for "someone active here" and
 * complements nothing in particular, so it is left out on purpose.
 */
import type { RoleStampCategory } from "@/lib/passport/roleStamp";

/** Unordered pairs of crafts that usually make one piece of work together. */
const PAIRS: ReadonlyArray<readonly [RoleStampCategory, RoleStampCategory]> = [
  ["music", "photo_video"], // music videos, live sets, album visuals
  ["music", "dance"],
  ["music", "design"], // artwork, identity
  ["music", "writing"], // lyrics, scripts, liner notes
  ["music", "crew"], // productions, tours, shows
  ["photo_video", "fashion"],
  ["photo_video", "model"],
  ["photo_video", "design"],
  ["photo_video", "writing"], // scripts, treatments, captions
  ["photo_video", "crew"],
  ["photo_video", "dance"],
  ["fashion", "model"],
  ["fashion", "design"],
  ["fashion", "dance"],
  ["design", "software"], // product, web, interfaces
  ["design", "writing"],
  ["dance", "crew"],
];

const key = (a: RoleStampCategory, b: RoleStampCategory) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const PAIR_SET = new Set(PAIRS.map(([a, b]) => key(a, b)));

/** True when the two crafts are different and usually combined. Symmetric. */
export function isComplementaryCraft(a: RoleStampCategory, b: RoleStampCategory): boolean {
  if (a === b || a === "creator" || b === "creator") return false;
  return PAIR_SET.has(key(a, b));
}

/**
 * The skills the other person lists that you do not, in their order, lowercased, no duplicates:
 * what they would bring to a piece of work that you cannot already do yourself.
 */
export function skillsTheyBring(mine: ReadonlySet<string>, theirs: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of theirs ?? []) {
    const s = raw.toLowerCase().trim();
    if (s && !mine.has(s) && !out.includes(s)) out.push(s);
  }
  return out;
}
