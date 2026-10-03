// Shared, fail-closed project access check for edge functions that read or
// write with the service role (which bypasses RLS).
//
// Rule: access is granted only when membership can be PROVEN from the
// canonical records -- projects.created_by (owner) or an ACCEPTED
// project_collaborators row. Anything else is denied, including lookup
// errors, malformed ids, 'pending' invitees and unknown roles.
//
// Why this exists: the SQL helper user_has_project_access() also admits
// status = 'pending', so an unaccepted invitee could reach project data
// through any function that used it as its only gate. Role semantics mirror
// get_project_role() / can_see_milestone_money() in
// supabase/migrations/20260825100000_studio_role_based_money_rls.sql, except
// that an unknown or NULL role resolves to the most restrictive tier
// ('guest') instead of 'collaborator'.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProjectRole = "owner" | "collaborator" | "creative" | "client" | "guest";

export interface ProjectAccess {
  projectId: string;
  userId: string;
  role: ProjectRole;
  isOwner: boolean;
  /** owner / creative / collaborator only -- never client or guest. */
  canSeeMoney: boolean;
}

type AdminClient = { from: (t: string) => any };

export class ProjectAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Most restrictive first: when a user has several rows, the lowest tier wins. */
const TIERS: ProjectRole[] = ["guest", "client", "creative", "collaborator", "owner"];

function normalizeRole(raw: unknown): ProjectRole {
  if (raw === "client" || raw === "creative" || raw === "guest") return raw;
  if (raw === "member") return "collaborator";
  return "guest";
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Throws ProjectAccessError unless `userId` is the project owner or an
 * accepted collaborator (optionally restricted to `allowRoles`).
 */
export async function requireProjectAccess(
  admin: AdminClient,
  projectId: unknown,
  userId: string | null | undefined,
  opts: { allowRoles?: ProjectRole[] } = {},
): Promise<ProjectAccess> {
  if (!userId) throw new ProjectAccessError("Authentication required", 401);
  if (!isUuid(projectId)) throw new ProjectAccessError("No access to this project");

  const { data: project, error: projectErr } = await admin
    .from("projects")
    .select("id, created_by")
    .eq("id", projectId)
    .maybeSingle();
  if (projectErr) {
    console.error("[projectAccess] project lookup failed", projectErr.message);
    throw new ProjectAccessError("Could not verify project access", 503);
  }
  if (!project) throw new ProjectAccessError("No access to this project");

  let role: ProjectRole | null = null;
  if (project.created_by === userId) {
    role = "owner";
  } else {
    const { data: rows, error: collabErr } = await admin
      .from("project_collaborators")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("status", "accepted");
    if (collabErr) {
      console.error("[projectAccess] collaborator lookup failed", collabErr.message);
      throw new ProjectAccessError("Could not verify project access", 503);
    }
    for (const row of rows ?? []) {
      const candidate = normalizeRole(row?.role);
      if (role === null || TIERS.indexOf(candidate) < TIERS.indexOf(role)) role = candidate;
    }
  }

  if (!role) throw new ProjectAccessError("No access to this project");
  if (opts.allowRoles && !opts.allowRoles.includes(role)) {
    throw new ProjectAccessError("Your role cannot perform this action");
  }

  return {
    projectId,
    userId,
    role,
    isOwner: role === "owner",
    canSeeMoney: role === "owner" || role === "creative" || role === "collaborator",
  };
}

export type ProjectAccessGuard =
  | { ok: true; access: ProjectAccess }
  | { ok: false; response: Response };

/** requireProjectAccess, but returns a ready-to-send JSON Response on denial. */
export async function guardProjectAccess(
  admin: AdminClient,
  projectId: unknown,
  userId: string | null | undefined,
  corsHeaders: Record<string, string>,
  opts: { allowRoles?: ProjectRole[] } = {},
): Promise<ProjectAccessGuard> {
  try {
    return { ok: true, access: await requireProjectAccess(admin, projectId, userId, opts) };
  } catch (e) {
    const status = e instanceof ProjectAccessError ? e.status : 503;
    const message = e instanceof ProjectAccessError ? e.message : "Could not verify project access";
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
}

const OPERATOR_ROLES: ProjectRole[] = ["owner", "collaborator", "creative"];

/**
 * Can `userId` act on a call/recording? Granted to the call's host, to a
 * recorded participant (only when `allowParticipant`), or to a non-guest
 * accepted member of the call's project. Everything else is denied.
 */
export async function userMayActOnCall(
  admin: AdminClient,
  userId: string,
  call: { host_id?: string | null; project_id?: string | null; participants?: unknown },
  opts: { allowParticipant?: boolean; cache?: Map<string, boolean> } = {},
): Promise<boolean> {
  if (call.host_id && call.host_id === userId) return true;

  if (opts.allowParticipant && Array.isArray(call.participants)) {
    for (const p of call.participants) {
      if (p === userId || (p && typeof p === "object" && ((p as any).user_id === userId || (p as any).id === userId))) {
        return true;
      }
    }
  }

  if (call.project_id) {
    const cached = opts.cache?.get(call.project_id);
    if (cached !== undefined) return cached;
    let allowed = false;
    try {
      await requireProjectAccess(admin, call.project_id, userId, { allowRoles: OPERATOR_ROLES });
      allowed = true;
    } catch (_) {
      allowed = false;
    }
    opts.cache?.set(call.project_id, allowed);
    return allowed;
  }

  return false;
}

/**
 * For deliberately public previews (invite OG image): has the project been
 * explicitly put up for sharing -- an unrevoked, unexpired guest link or a
 * pending invitation? Fails closed (false) on any lookup error.
 */
export async function projectHasExplicitShare(admin: AdminClient, projectId: unknown): Promise<boolean> {
  if (!isUuid(projectId)) return false;
  try {
    const nowIso = new Date().toISOString();
    const { data: links, error: linkErr } = await admin
      .from("project_guest_links")
      .select("id")
      .eq("project_id", projectId)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .limit(1);
    if (linkErr) return false;
    if (links?.length) return true;

    const { data: invites, error: inviteErr } = await admin
      .from("project_collaborators")
      .select("id")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .limit(1);
    if (inviteErr) return false;
    return !!invites?.length;
  } catch (_) {
    return false;
  }
}
