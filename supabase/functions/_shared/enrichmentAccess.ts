// Who may enrich whose profile. Pure: imported by edge functions (Deno) and by tests (Vite).
//
// Why: enrich-creator-profile, enrich-press-links and enrich-credits take the profile to enrich as `user_id` in the request.
// They checked that SOMEONE was signed in (and rate-limited them), never that the profile was theirs: any member could name
// another member's id and have an AI write that member's bio, avatar, skills, job title, press links, awards and credits, at
// our cost; enrich-credits with no id enriched a batch of every member's credits. Three callers have a right to enrich:
//   - the member, their own profile;
//   - an admin, any profile (this includes the unclaimed profiles imported for the public directory, which no member owns);
//   - the platform itself (batch-enrich-profiles and cron call these functions with the service role).
// Anyone else gets the answer a missing profile gets, so the endpoint does not tell members which ids exist.

export type EnrichmentCaller = { kind: "service" } | { kind: "user"; id: string; isAdmin: boolean };

export type EnrichmentDecision =
  | { ok: true; reason: "service" | "self" | "admin" }
  | { ok: false; status: 400 | 403 | 404; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProfileId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const NOT_FOUND: EnrichmentDecision = { ok: false, status: 404, error: "Profile not found" };

/** The profile named by the request, once it has been loaded (`profile` is null when no such profile exists). */
export function decideEnrichmentTarget(input: {
  caller: EnrichmentCaller;
  targetUserId: unknown;
  profile: { user_id?: unknown } | null | undefined;
}): EnrichmentDecision {
  if (!isProfileId(input.targetUserId)) return { ok: false, status: 400, error: "user_id must be a valid id" };
  if (!input.profile) return NOT_FOUND;
  const { caller, targetUserId } = input;
  if (caller.kind === "service") return { ok: true, reason: "service" };
  if (caller.id === targetUserId) return { ok: true, reason: "self" };
  if (caller.isAdmin) return { ok: true, reason: "admin" };
  return NOT_FOUND;
}

/** A run over many members (no user_id): the platform or an admin, never a member. */
export function decideEnrichmentBatch(caller: EnrichmentCaller): EnrichmentDecision {
  if (caller.kind === "service") return { ok: true, reason: "service" };
  if (caller.isAdmin) return { ok: true, reason: "admin" };
  return { ok: false, status: 403, error: "Enriching every member's data is restricted to administrators" };
}
