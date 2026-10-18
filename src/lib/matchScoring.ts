/**
 * Match scoring — one algorithm shared by the deck (useSwipeProfiles) and
 * the grid (BrowseCreators) so "who ranks where" means the same thing in
 * both places instead of two hand-rolled heuristics drifting apart.
 *
 * Priority order (per the Match overhaul brief), highest weight first:
 *   1. Same sector/craft   -- 40 (or, for a different craft that is usually combined with yours,
 *      30 + up to 10 for skills you lack: the two cases are exclusive, so the ceiling is the same)
 *   2. Same city            -- 25
 *   3. Past collaboration   -- 35
 *   4. Shared skills ratio  -- up to 20
 *   5. Discovery jitter     -- up to 10, deterministic per viewer+candidate
 *      (a stable hash, not Math.random): the same viewer sees the same order
 *      for the same data, yet different viewers still get different
 *      tie-breaks, so one profile is not everyone's #1 by accident.
 *
 * Deliberately additive, never a filter: a candidate who matches none of
 * these still gets a (small, random-dominated) score and still appears --
 * "no artificial gating" is a hard product requirement here, priority
 * ordering is not the same thing as exclusion.
 */
import { supabase } from "@/integrations/supabase/client";
import { getRoleStampCategory, type RoleStampCategory } from "@/lib/passport/roleStamp";
import { stableUnit } from "@/lib/matchRanking";
import { isComplementaryCraft, skillsTheyBring } from "@/lib/matchComplement";

export interface MatchProfileInput {
  userId: string;
  role?: string | null;
  subRoles?: string[] | null;
  location?: string | null;
  skills?: string[];
}

export interface MatchSignals {
  sameSector: boolean;
  sameCity: boolean;
  pastCollab: boolean;
  skillOverlapRatio: number;
  /** The skills both people actually list (lowercased, no duplicates): the evidence behind skillOverlapRatio. */
  sharedSkills?: string[];
  /** Different crafts that are usually combined (lib/matchComplement.ts). Never true together with sameSector. */
  complementaryCraft?: boolean;
  /** The skills they list that you do not (lowercased, no duplicates). Only counted for a complementary craft. */
  newSkills?: string[];
}

export interface MatchScoreResult extends MatchSignals {
  /**
   * A RANKING WEIGHT, not a percentage: the weights above add up to 130 (40 + 25 + 35 + 20 + 10), so it
   * can exceed 100, and its last 10 points are a deterministic tie-break, not a property of the person.
   * It decides the order and is never shown. What people see are the concrete reasons (matchReasons.ts).
   */
  score: number;
}

/** The largest value `score` can take. Kept next to the weights so the two cannot drift. */
export const MATCH_SCORE_MAX = 40 + 25 + 35 + 20 + 10;
/** A complementary craft is worth a little less than the same craft, and skills you lack top it up to the same 40. */
export const COMPLEMENTARY_CRAFT_WEIGHT = 30;
export const NEW_SKILL_WEIGHT = 5;
export const NEW_SKILLS_COUNTED = 2;

/** "Los Angeles, CA" -> "los angeles". Same city-extraction rule already
 *  used across discovery (useSwipeProfiles, BrowseCreators) -- kept
 *  identical here rather than introducing a second definition of "city". */
export function extractCity(location?: string | null): string {
  return (location || "").toLowerCase().split(",")[0]?.trim() || "";
}

/** Normalizes professional_skills/passion_skills (array of strings, array
 *  of {skill}/{name} objects, or a legacy keyed object) into a flat,
 *  lowercased string array. */
export function extractSkillsArray(raw: unknown): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
  return arr
    .map((s) => (typeof s === "string" ? s : (s as { skill?: string; name?: string })?.skill || (s as { name?: string })?.name || ""))
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

/**
 * Every user_id the given user has an accepted collaboration history with:
 * fellow accepted collaborators on projects they own, plus (when they were
 * themselves an accepted collaborator) that project's owner and its other
 * accepted collaborators. A handful of small, targeted queries -- most
 * users have at most a few dozen projects, not hundreds.
 */
export async function fetchPastCollaboratorIds(userId: string): Promise<Set<string>> {
  const [{ data: ownedProjects }, { data: myCollabRows }] = await Promise.all([
    supabase.from("projects").select("id").eq("created_by", userId),
    supabase.from("project_collaborators").select("project_id").eq("user_id", userId).eq("status", "accepted"),
  ]);

  const projectIds = new Set<string>([
    ...((ownedProjects || []).map((p) => p.id)),
    ...((myCollabRows || []).map((c) => c.project_id)),
  ]);
  if (projectIds.size === 0) return new Set();

  const idList = Array.from(projectIds);
  const [{ data: collaboratorRows }, { data: projectOwners }] = await Promise.all([
    supabase.from("project_collaborators").select("project_id, user_id").in("project_id", idList).eq("status", "accepted"),
    supabase.from("projects").select("id, created_by").in("id", idList),
  ]);

  const collaboratorIds = new Set<string>();
  (collaboratorRows || []).forEach((r) => { if (r.user_id) collaboratorIds.add(r.user_id); });
  (projectOwners || []).forEach((p) => { if (p.created_by) collaboratorIds.add(p.created_by); });
  collaboratorIds.delete(userId);
  return collaboratorIds;
}

/** The current user's own signals, precomputed once per discovery session
 *  rather than per candidate. */
export interface MyMatchContext {
  sector: RoleStampCategory;
  city: string;
  skills: Set<string>;
  pastCollabIds: Set<string>;
  /** Viewer id; seeds the deterministic jitter so it differs per viewer. */
  seed: string;
}

export function buildMyMatchContext(
  me: { role?: string | null; sub_roles?: string[] | null; location?: string | null; professional_skills?: unknown; passion_skills?: unknown },
  pastCollabIds: Set<string>,
  seed = "",
): MyMatchContext {
  return {
    sector: getRoleStampCategory({ role: me.role, sub_roles: me.sub_roles }),
    city: extractCity(me.location),
    skills: new Set([...extractSkillsArray(me.professional_skills), ...extractSkillsArray(me.passion_skills)]),
    pastCollabIds,
    seed,
  };
}

export function computeMatchScore(me: MyMatchContext, candidate: MatchProfileInput): MatchScoreResult {
  const theirSector = getRoleStampCategory({ role: candidate.role, sub_roles: candidate.subRoles });
  const sameSector = theirSector === me.sector;
  const complementaryCraft = !sameSector && isComplementaryCraft(me.sector, theirSector);
  const sameCity = !!me.city && extractCity(candidate.location) === me.city;
  const pastCollab = me.pastCollabIds.has(candidate.userId);

  const theirSkills = [...new Set((candidate.skills || []).map(s => s.toLowerCase().trim()).filter(Boolean))];
  const sharedSkills = theirSkills.filter((s) => me.skills.has(s));
  const overlap = sharedSkills.length;
  const denominator = Math.max(me.skills.size, theirSkills.length, 1);
  const skillOverlapRatio = overlap / denominator;

  const newSkills = complementaryCraft ? skillsTheyBring(me.skills, theirSkills) : [];

  const score =
    (sameSector ? 40 : 0) +
    (complementaryCraft ? COMPLEMENTARY_CRAFT_WEIGHT + Math.min(newSkills.length, NEW_SKILLS_COUNTED) * NEW_SKILL_WEIGHT : 0) +
    (sameCity ? 25 : 0) +
    (pastCollab ? 35 : 0) +
    skillOverlapRatio * 20 +
    stableUnit(`${me.seed}:${candidate.userId}`) * 10;

  return { score, sameSector, sameCity, pastCollab, skillOverlapRatio, sharedSkills, complementaryCraft, newSkills };
}
