/**
 * Match scoring — one algorithm shared by the deck (useSwipeProfiles) and
 * the grid (BrowseCreators) so "who ranks where" means the same thing in
 * both places instead of two hand-rolled heuristics drifting apart.
 *
 * Priority order (per the Match overhaul brief), highest weight first:
 *   1. Same sector/craft   -- 40
 *   2. Same city            -- 25
 *   3. Past collaboration   -- 35
 *   4. Shared skills ratio  -- up to 20
 *   5. Random discovery     -- up to 10
 *
 * Deliberately additive, never a filter: a candidate who matches none of
 * these still gets a (small, random-dominated) score and still appears --
 * "no artificial gating" is a hard product requirement here, priority
 * ordering is not the same thing as exclusion.
 */
import { supabase } from "@/integrations/supabase/client";
import { getRoleStampCategory, type RoleStampCategory } from "@/lib/passport/roleStamp";

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
}

export interface MatchScoreResult extends MatchSignals {
  score: number;
}

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
}

export function buildMyMatchContext(
  me: { role?: string | null; sub_roles?: string[] | null; location?: string | null; professional_skills?: unknown; passion_skills?: unknown },
  pastCollabIds: Set<string>,
): MyMatchContext {
  return {
    sector: getRoleStampCategory({ role: me.role, sub_roles: me.sub_roles }),
    city: extractCity(me.location),
    skills: new Set([...extractSkillsArray(me.professional_skills), ...extractSkillsArray(me.passion_skills)]),
    pastCollabIds,
  };
}

export function computeMatchScore(me: MyMatchContext, candidate: MatchProfileInput): MatchScoreResult {
  const sameSector = getRoleStampCategory({ role: candidate.role, sub_roles: candidate.subRoles }) === me.sector;
  const sameCity = !!me.city && extractCity(candidate.location) === me.city;
  const pastCollab = me.pastCollabIds.has(candidate.userId);

  const theirSkills = candidate.skills || [];
  const overlap = theirSkills.filter((s) => me.skills.has(s.toLowerCase())).length;
  const denominator = Math.max(me.skills.size, theirSkills.length, 1);
  const skillOverlapRatio = overlap / denominator;

  const score =
    (sameSector ? 40 : 0) +
    (sameCity ? 25 : 0) +
    (pastCollab ? 35 : 0) +
    skillOverlapRatio * 20 +
    Math.random() * 10;

  return { score, sameSector, sameCity, pastCollab, skillOverlapRatio };
}
