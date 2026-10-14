// Who may run a Studio generator (AI image, AI copy, document ingest, event
// guest matching) on a project. These functions spend the owner's AI quota and
// write into the project (assets, facts, matches) with the service role, so
// they are operator actions.
//
// Rule: the project owner, or an ACCEPTED collaborator whose role is
// collaborator or creative. Not a pending invitee, not a guest, not a client
// (clients review; they do not feed the Studio Brain or spend its quota), and
// not a lookup that failed: that answers 503 and grants nothing.
//
// Why this exists: four generators decided membership with "any
// project_collaborators row", with no status and no role, so a pending invitee
// or a guest passed. The proof is the canonical check in projectAccess.ts; this
// file only fixes which roles count, in one place.

import { ProjectAccessError, requireProjectAccess, type ProjectRole } from "./projectAccess.ts";

export const STUDIO_OPERATOR_ROLES: ProjectRole[] = ["owner", "collaborator", "creative"];

type AdminClient = Parameters<typeof requireProjectAccess>[0];

export type StudioOperatorResult =
  | { ok: true; role: ProjectRole }
  | { ok: false; status: 401 | 403 | 503; message: string };

export async function studioOperatorAccess(
  admin: AdminClient,
  projectId: unknown,
  userId: string | null | undefined,
): Promise<StudioOperatorResult> {
  try {
    const access = await requireProjectAccess(admin, projectId, userId, { allowRoles: STUDIO_OPERATOR_ROLES });
    return { ok: true, role: access.role };
  } catch (e) {
    if (e instanceof ProjectAccessError) {
      const status = e.status === 401 ? 401 : e.status === 503 ? 503 : 403;
      return { ok: false, status, message: e.message };
    }
    return { ok: false, status: 503, message: "Could not verify project access" };
  }
}

export type StudioOperatorGuard =
  | { ok: true; role: ProjectRole }
  | { ok: false; response: Response };

/** studioOperatorAccess, but returns a ready-to-send JSON Response on denial. */
export async function guardStudioOperator(
  admin: AdminClient,
  projectId: unknown,
  userId: string | null | undefined,
  corsHeaders: Record<string, string>,
): Promise<StudioOperatorGuard> {
  const result = await studioOperatorAccess(admin, projectId, userId);
  if (result.ok === true) return result;
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: result.message }), {
      status: result.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  };
}
