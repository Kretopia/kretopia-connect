// The pool a company's criteria are checked against: every profile with a completed Passport that the public view
// already shows to anyone, with its credits and its synced accounts. Nothing here is private: the view, the credits and the
// synced accounts are all readable by any signed-in user. Company accounts and the searcher are left out.

import { classifyCreditEvidence } from "@/lib/passport/creditEvidence";
import { PLATFORM_IDS, type PlatformId } from "./need";
import type { CandidateFacts, FactsCredit } from "./evaluate";

export interface ProfileRow {
  user_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  bio?: string | null;
  location?: string | null;
  professional_skills?: unknown;
  account_type?: string | null;
  tiktok_url?: string | null;
  instagram_url?: string | null;
  youtube_url?: string | null;
  spotify_url?: string | null;
  soundcloud_url?: string | null;
  behance_url?: string | null;
}

export interface CreditRow {
  user_id: string;
  credit_category?: string | null;
  project_type?: string | null;
  project_name?: string | null;
  role?: string | null;
  client_brand?: string | null;
  tags?: unknown;
  verification_status?: string | null;
  endorsement_count?: number | null;
  ai_confidence?: number | null;
  source?: string | null;
}

export interface PlatformRow {
  user_id: string;
  platform?: string | null;
  platform_data?: unknown;
}

const LINK_FIELD: Record<PlatformId, keyof ProfileRow> = {
  tiktok: "tiktok_url",
  instagram: "instagram_url",
  youtube: "youtube_url",
  spotify: "spotify_url",
  soundcloud: "soundcloud_url",
  behance: "behance_url",
};

const AUDIENCE_KEYS = ["subscriberCount", "subscribers", "followers", "followerCount", "followers_count"];

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** professional_skills is a JSON array of strings or { skill } / { name } objects. */
export function skillList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === "string" ? s : s && typeof s === "object" ? ((s as { skill?: unknown; name?: unknown }).skill ?? (s as { name?: unknown }).name) : ""))
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
}

/** The follower figure a sync stored, or null. Stored as a string on YouTube; anything not a whole non-negative number is null. */
export function audienceOf(platformData: unknown): number | null {
  if (!platformData || typeof platformData !== "object") return null;
  const data = platformData as Record<string, unknown>;
  for (const key of AUDIENCE_KEYS) {
    const raw = data[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[,\s]/g, ""));
    return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : null;
  }
  return null;
}

export function buildCandidateFacts(profile: ProfileRow, credits: readonly CreditRow[], platforms: readonly PlatformRow[]): CandidateFacts {
  const links: CandidateFacts["links"] = {};
  for (const id of PLATFORM_IDS) if (text(profile[LINK_FIELD[id]])) links[id] = true;

  const synced: CandidateFacts["synced"] = {};
  for (const p of platforms) {
    const id = (p.platform ?? "").toLowerCase() as PlatformId;
    if ((PLATFORM_IDS as readonly string[]).includes(id)) synced[id] = { audience: audienceOf(p.platform_data) };
  }

  const factCredits: FactsCredit[] = credits
    .filter((c) => c.source !== "portfolio") // a portfolio piece is media, not a credit
    .map((c) => ({
      category: c.credit_category ?? null,
      projectType: c.project_type ?? null,
      projectName: c.project_name ?? null,
      role: c.role ?? null,
      clientBrand: c.client_brand ?? null,
      tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === "string") : null,
      evidence: classifyCreditEvidence(c),
    }));

  return {
    userId: profile.user_id,
    fullName: text(profile.full_name) ?? "Creative",
    avatarUrl: text(profile.avatar_url),
    role: text(profile.role),
    bio: text(profile.bio),
    location: text(profile.location),
    skills: skillList(profile.professional_skills),
    links,
    synced,
    credits: factCredits,
  };
}

// The slice of the Supabase client used here, so the queries can be checked without a network.
type Query = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> & Record<string, (...args: unknown[]) => Query>;
export interface PoolClient {
  from: (table: string) => { select: (columns: string) => Query };
}

export const POOL_LIMIT = 300;
const CHUNK = 40;
const ROW_CAP = 1000; // PostgREST returns at most this many rows per request

async function run(query: Query, label: string): Promise<unknown[]> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

export interface CandidatePool {
  pool: CandidateFacts[];
  /** Profiles looked at, before company accounts and the searcher were removed. */
  examined: number;
  /** True when a query hit a cap, so the pool may be incomplete. */
  truncated: boolean;
}

export async function loadCandidatePool(client: PoolClient, opts: { excludeUserId?: string | null; limit?: number } = {}): Promise<CandidatePool> {
  const limit = opts.limit ?? POOL_LIMIT;
  const profileRows = (await run(
    client.from("public_profiles_safe")
      .select("user_id, full_name, avatar_url, role, bio, location, professional_skills, account_type, tiktok_url, instagram_url, youtube_url, spotify_url, soundcloud_url, behance_url")
      .eq("onboarding_completed", true)
      .order("user_id", { ascending: true })
      .limit(limit + 1),
    "profiles",
  )) as ProfileRow[];
  let truncated = profileRows.length > limit;
  const profiles = profileRows.slice(0, limit).filter((p) => p.account_type !== "company" && p.user_id !== opts.excludeUserId);

  const ids = profiles.map((p) => p.user_id);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

  const creditRows: CreditRow[] = [];
  const platformRows: PlatformRow[] = [];
  await Promise.all(
    chunks.map(async (chunk) => {
      const [c, p] = await Promise.all([
        run(client.from("credits").select("user_id, credit_category, project_type, project_name, role, client_brand, tags, verification_status, endorsement_count, ai_confidence, source").in("user_id", chunk), "credits"),
        run(client.from("connected_platforms_public").select("user_id, platform, platform_data").in("user_id", chunk), "connected platforms"),
      ]);
      if (c.length >= ROW_CAP || p.length >= ROW_CAP) truncated = true;
      creditRows.push(...(c as CreditRow[]));
      platformRows.push(...(p as PlatformRow[]));
    }),
  );

  const creditsBy = new Map<string, CreditRow[]>();
  for (const row of creditRows) (creditsBy.get(row.user_id) ?? creditsBy.set(row.user_id, []).get(row.user_id)!).push(row);
  const platformsBy = new Map<string, PlatformRow[]>();
  for (const row of platformRows) (platformsBy.get(row.user_id) ?? platformsBy.set(row.user_id, []).get(row.user_id)!).push(row);

  return {
    pool: profiles.map((p) => buildCandidateFacts(p, creditsBy.get(p.user_id) ?? [], platformsBy.get(p.user_id) ?? [])),
    examined: Math.min(profileRows.length, limit),
    truncated,
  };
}
