// Pure authorization decisions for a company (organization) boundary. Imported
// by edge functions (Deno) and by tests (Vite). No dependency, no I/O, and
// wired to nothing yet: it is the server-side primitive the Company Experience
// gate needs, written first with its full denied-path matrix so that no feature
// has to invent its own rule (docs/roadmap/company-experience-gate-status.md).
//
// Records used (they already exist, inert, since 20260912130000):
//   organizations(id, owner_id), organization_members(org_id, user_id, role in
//   owner|admin|member), projects.org_id (nullable), project_collaborators.
//
// Rules, each of them the conservative reading of CE p.32 ("one owner role at
// launch, scoped members, removal revokes immediately") and of the program's
// "never silently merge personal and company data":
//   - the caller's role comes from a membership row read by the server for
//     THIS org; no membership row (never a member, or removed) is no role;
//   - an unrelated caller is told "not found", not "forbidden": the existence
//     of a company is not disclosed to people outside it;
//   - the owner can do everything; an admin everything except what changes the
//     owner or deletes the company; a member only reads the company and the
//     company projects they are an accepted collaborator on;
//   - a project belongs to a company only through its own `org_id`: a project
//     with no `org_id` is personal and is never reachable through a company
//     role, and a company project is never reachable through a role of
//     another company;
//   - being an accepted collaborator on a company project (a client, a guest,
//     a freelancer) gives that project, never the company;
//   - an action this module does not know is denied.

export type OrgRole = "owner" | "admin" | "member";

export type OrgAction =
  | "view_company"
  | "manage_members"
  | "manage_settings"
  | "create_company_project"
  | "delete_company"
  | "transfer_ownership";

export type ProjectAction = "view_project" | "manage_project";

export interface Membership {
  org_id: string;
  user_id: string;
  role: string | null | undefined;
}

export type OrgDecision =
  | { allowed: true; role: OrgRole }
  | { allowed: false; status: 401 | 403 | 404; reason: "unauthenticated" | "not_a_member" | "role_not_allowed" | "unknown_action" };

const ROLES: readonly OrgRole[] = ["owner", "admin", "member"];

const ALLOWED: Record<OrgAction, readonly OrgRole[]> = {
  view_company: ["owner", "admin", "member"],
  manage_members: ["owner", "admin"],
  manage_settings: ["owner", "admin"],
  create_company_project: ["owner", "admin"],
  delete_company: ["owner"],
  transfer_ownership: ["owner"],
};

function normaliseRole(role: unknown): OrgRole | null {
  const r = typeof role === "string" ? role.trim().toLowerCase() : "";
  return (ROLES as readonly string[]).includes(r) ? (r as OrgRole) : null;
}

/** May this caller perform a company-level action on this organization? */
export function decideOrgAccess(input: {
  userId: string | null | undefined;
  orgId: string;
  /** The caller's membership row for THIS organization, as read by the server; null when none. */
  membership: Membership | null | undefined;
  action: OrgAction | string;
}): OrgDecision {
  if (!input.userId) return { allowed: false, status: 401, reason: "unauthenticated" };
  const action = input.action as OrgAction;
  // Own keys only: "toString" and "__proto__" are `in` any object and are not actions.
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, action)) {
    return { allowed: false, status: 403, reason: "unknown_action" };
  }

  const m = input.membership;
  // A row for another organization or another user is no membership at all.
  const role = m && m.org_id === input.orgId && m.user_id === input.userId ? normaliseRole(m.role) : null;
  if (!role) return { allowed: false, status: 404, reason: "not_a_member" };

  if (!ALLOWED[action].includes(role)) return { allowed: false, status: 403, reason: "role_not_allowed" };
  return { allowed: true, role };
}

export type ProjectDecision =
  | { allowed: true; via: "company_owner" | "company_admin" | "project_collaborator" }
  | { allowed: false; status: 401 | 403 | 404; reason: "unauthenticated" | "personal_project" | "not_found" | "role_not_allowed" | "unknown_action" };

/**
 * May this caller act on this project? `projectOrgId` is the project's own `org_id` (null = personal).
 * `isAcceptedCollaborator` is the caller's accepted `project_collaborators` row for THIS project.
 */
export function decideCompanyProjectAccess(input: {
  userId: string | null | undefined;
  /** The company through which access is being claimed. */
  orgId: string;
  projectOrgId: string | null | undefined;
  membership: Membership | null | undefined;
  isAcceptedCollaborator: boolean;
  action: ProjectAction | string;
}): ProjectDecision {
  if (!input.userId) return { allowed: false, status: 401, reason: "unauthenticated" };
  if (input.action !== "view_project" && input.action !== "manage_project") {
    return { allowed: false, status: 403, reason: "unknown_action" };
  }
  // A project with no org_id is personal: no company role reaches it.
  if (!input.projectOrgId) return { allowed: false, status: 404, reason: "personal_project" };
  // A project of another company is not this company's.
  if (input.projectOrgId !== input.orgId) return { allowed: false, status: 404, reason: "not_found" };

  const m = input.membership;
  const role = m && m.org_id === input.orgId && m.user_id === input.userId ? normaliseRole(m.role) : null;

  if (role === "owner") return { allowed: true, via: "company_owner" };
  if (role === "admin") return { allowed: true, via: "company_admin" };
  // A member, a client, a guest or a freelancer reaches the project only as its accepted collaborator.
  if (input.isAcceptedCollaborator) return { allowed: true, via: "project_collaborator" };
  return role
    ? { allowed: false, status: 403, reason: "role_not_allowed" }
    : { allowed: false, status: 404, reason: "not_found" };
}
