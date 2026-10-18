/**
 * Why a profile was suggested, in words, from facts both people already put on Kretopia.
 *
 * The number behind the ranking (matchScoring.ts) is a weight, not a measure of how well two people
 * would work together, so it is never shown. What is shown instead are the concrete reasons it was
 * built from. Every reason here comes from a real field or a real signal; when none applies the list is
 * empty and the caller says so, rather than inventing one ("great collaboration potential").
 *
 * Pure and dependency-free so the deck, the grid and the explanation dialog say the same thing.
 */
import type { MatchSignals } from "@/lib/matchScoring";

export type MatchReasonKey =
  | "interested-in-you"
  | "past-collab"
  | "shared-craft"
  | "complementary-craft"
  | "shared-skills"
  | "new-skills"
  | "same-city"
  | "recent-activity"
  | "open-to-collab";

export interface MatchReason {
  key: MatchReasonKey;
  label: string;
}

export interface MatchReasonInput {
  signals?: Partial<MatchSignals> | null;
  /** The suggested person's own role, as they wrote it. */
  role?: string | null;
  /** The suggested person's own location, as they wrote it. */
  location?: string | null;
  /** `last_active_date`, else `updated_at`: whichever the source row carries. */
  lastActiveAt?: string | null;
  /** The suggested person's own `collab_intent`. */
  collabIntent?: string | null;
  /** They have already swiped right on you (the "Interested" list shows the same fact to you). */
  likedYou?: boolean;
  /** How many reasons to return, strongest first. Default 3. */
  max?: number;
  /** Injected for tests. */
  now?: number;
}

/** Same window the ranking uses for its strongest recency boost (matchRanking.recencyBoost). */
export const RECENT_ACTIVITY_DAYS = 14;
const DAY_MS = 86_400_000;
const MAX_SKILLS_SHOWN = 3;

const sentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function skillsLabel(prefix: string, skills: string[]): string {
  const shown = skills.slice(0, MAX_SKILLS_SHOWN).map(sentenceCase).join(", ");
  const more = skills.length - MAX_SKILLS_SHOWN;
  return more > 0 ? `${prefix}: ${shown} +${more}` : `${prefix}: ${shown}`;
}

export function buildMatchReasons(input: MatchReasonInput): MatchReason[] {
  const { signals, role, location, lastActiveAt, collabIntent, likedYou } = input;
  const max = input.max ?? 3;
  const now = input.now ?? Date.now();
  const out: MatchReason[] = [];

  if (likedYou) out.push({ key: "interested-in-you", label: "Already interested in you" });

  if (signals?.pastCollab) out.push({ key: "past-collab", label: "You've worked together before" });

  if (signals?.sameSector) {
    const r = (role ?? "").trim();
    out.push({ key: "shared-craft", label: r ? `Shared craft · ${r}` : "Shared craft" });
  }

  // A different craft that is usually combined with yours: the complement of "shared craft", never both.
  if (signals?.complementaryCraft && !signals?.sameSector) {
    const r = (role ?? "").trim();
    out.push({ key: "complementary-craft", label: r ? `Complements your craft · ${r}` : "Complements your craft" });
  }

  const shared = signals?.sharedSkills ?? [];
  if (shared.length > 0) {
    out.push({ key: "shared-skills", label: skillsLabel("Shared skills", shared) });
  } else if ((signals?.skillOverlapRatio ?? 0) > 0.3) {
    // A source that only knows the ratio (no names) still says what it knows, no more.
    out.push({ key: "shared-skills", label: "Similar skills" });
  }

  const brought = signals?.newSkills ?? [];
  if (signals?.complementaryCraft && brought.length > 0) {
    out.push({ key: "new-skills", label: skillsLabel("Brings skills you don't list", brought) });
  }

  if (signals?.sameCity) {
    const city = (location ?? "").split(",")[0]?.trim();
    out.push({ key: "same-city", label: city ? `Based in ${city}` : "Based in your city" });
  }

  if (lastActiveAt) {
    const t = Date.parse(lastActiveAt);
    if (Number.isFinite(t) && now - t >= 0 && now - t <= RECENT_ACTIVITY_DAYS * DAY_MS) {
      out.push({ key: "recent-activity", label: "Active in the last 2 weeks" });
    }
  }

  // Only their own statement that they want collaborators. "Available for hire", "looking to hire" and
  // "open to trade" are other intents and are not rewritten into this one.
  if (collabIntent === "seeking_collaborators") out.push({ key: "open-to-collab", label: "Open to collaborating" });

  return out.slice(0, Math.max(0, max));
}
