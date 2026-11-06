import { supabase } from "@/integrations/supabase/client";
import { notifyUser } from "@/lib/notifyUser";

/**
 * Review of role claims. A member who asks to take a credited role on a Kretopia database project files a REQUEST
 * (`icdb_role_claim_requests`); nothing reaches their Passport until an admin decides it. The decision itself, the admin check and
 * the "claim the role once" rule all live in the database function `decide_icdb_role_claim`: this file only reads the queue and
 * calls that function, so a client can never grant a claim by itself.
 *
 * The tables and functions come from `supabase/migrations/20261106120000_featured_in_confirmation_and_role_claim_requests.sql`,
 * which may not be applied on the backend the app talks to. Every read and write here says so plainly instead of pretending an
 * empty queue.
 */
export type ClaimStatus = "pending" | "approved" | "rejected";

export interface RoleClaimRow {
  id: string;
  role_id: string;
  requester_id: string;
  thumbnail_url: string | null;
  status: ClaimStatus;
  note: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export interface ClaimedRole {
  id: string;
  project_id: string;
  role_title: string;
  person_name: string | null;
  is_claimed: boolean;
  claimed_by: string | null;
}

export interface ClaimedProject {
  id: string;
  title: string;
  year: number | null;
  type: string | null;
  platform: string | null;
  external_url: string | null;
}

/** Public-safe fields only: what anyone can already see on a Passport. */
export interface ClaimRequester {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  verification_status: string | null;
}

export interface RoleClaimView {
  request: RoleClaimRow;
  role: ClaimedRole | null;
  project: ClaimedProject | null;
  requester: ClaimRequester | null;
  /** Other members who also have a pending request for the same role. */
  competing: { requestId: string; name: string }[];
}

export type LoadResult =
  | { kind: "ok"; claims: RoleClaimView[]; truncated: boolean }
  | { kind: "not-set-up" }
  | { kind: "error"; message: string };

/** The most recent requests loaded at once. */
export const CLAIMS_LIMIT = 200;

/** True when the database says the table or function does not exist (the migration is not applied there). */
export function isMissingOnBackend(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42883" || error.code === "PGRST205" || error.code === "PGRST202") return true;
  return /does not exist|could not find the (table|function)|schema cache/i.test(error.message ?? "");
}

type Failure = { code?: string; message?: string } | null;

export async function loadRoleClaims(): Promise<LoadResult> {
  try {
    const claimsRes = await supabase
      .from("icdb_role_claim_requests" as never)
      .select("id, role_id, requester_id, thumbnail_url, status, note, created_at, decided_at, decided_by")
      .order("created_at", { ascending: false })
      .limit(CLAIMS_LIMIT + 1);
    const claimsError = claimsRes.error as Failure;
    if (claimsError) return isMissingOnBackend(claimsError) ? { kind: "not-set-up" } : { kind: "error", message: claimsError.message ?? "Could not load the claims." };

    const all = ((claimsRes.data ?? []) as unknown as RoleClaimRow[]);
    const truncated = all.length > CLAIMS_LIMIT;
    const rows = truncated ? all.slice(0, CLAIMS_LIMIT) : all;
    if (rows.length === 0) return { kind: "ok", claims: [], truncated: false };

    const roleIds = [...new Set(rows.map((r) => r.role_id))];
    const requesterIds = [...new Set(rows.map((r) => r.requester_id))];

    const [rolesRes, requestersRes] = await Promise.all([
      supabase.from("icdb_project_roles").select("id, project_id, role_title, person_name, is_claimed, claimed_by").in("id", roleIds),
      supabase.from("public_profiles_safe").select("user_id, full_name, username, avatar_url, verification_status").in("user_id", requesterIds),
    ]);
    // A lookup that failed is not an empty one: reviewing a claim without its role in front of you is how the wrong credit gets approved.
    if (rolesRes.error) return { kind: "error", message: rolesRes.error.message };
    if (requestersRes.error) return { kind: "error", message: requestersRes.error.message };

    const roles = new Map(((rolesRes.data ?? []) as ClaimedRole[]).map((r) => [r.id, r]));
    const projectIds = [...new Set([...roles.values()].map((r) => r.project_id))];
    const projectsRes = projectIds.length
      ? await supabase.from("icdb_projects").select("id, title, year, type, platform, external_url").in("id", projectIds)
      : { data: [], error: null };
    if (projectsRes.error) return { kind: "error", message: projectsRes.error.message };

    const projects = new Map(((projectsRes.data ?? []) as ClaimedProject[]).map((p) => [p.id, p]));
    const requesters = new Map(((requestersRes.data ?? []) as ClaimRequester[]).map((p) => [p.user_id, p]));

    const pendingByRole = new Map<string, RoleClaimRow[]>();
    for (const r of rows) if (r.status === "pending") pendingByRole.set(r.role_id, [...(pendingByRole.get(r.role_id) ?? []), r]);

    const claims = rows.map<RoleClaimView>((request) => {
      const role = roles.get(request.role_id) ?? null;
      return {
        request,
        role,
        project: role ? projects.get(role.project_id) ?? null : null,
        requester: requesters.get(request.requester_id) ?? null,
        competing:
          request.status === "pending"
            ? (pendingByRole.get(request.role_id) ?? [])
                .filter((other) => other.id !== request.id)
                .map((other) => ({ requestId: other.id, name: requesters.get(other.requester_id)?.full_name?.trim() || "A member" }))
            : [],
      };
    });
    return { kind: "ok", claims, truncated };
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : "Could not load the claims." };
  }
}

export type DecisionOutcome =
  | { kind: "approved"; creditId: string | null }
  | { kind: "rejected" }
  /** An admin approved, but the role had been claimed in the meantime, so the database declined the request instead. */
  | { kind: "declined-already-claimed" }
  | { kind: "already-decided"; status: string }
  | { kind: "forbidden" }
  | { kind: "not-set-up" }
  | { kind: "error"; message: string };

/** Reads the answer of `decide_icdb_role_claim` for the decision that was asked for. Exported for tests. */
export function readDecisionAnswer(approve: boolean, error: Failure, data: unknown): DecisionOutcome {
  if (error) {
    if (isMissingOnBackend(error)) return { kind: "not-set-up" };
    if (/only admins/i.test(error.message ?? "")) return { kind: "forbidden" };
    return { kind: "error", message: error.message ?? "The decision could not be saved." };
  }
  const body = (data && typeof data === "object" ? data : {}) as { success?: boolean; status?: string; error?: string; credit_id?: string };
  if (body.success === false) {
    const already = /^already (approved|rejected)/i.exec(body.error ?? "");
    return already ? { kind: "already-decided", status: already[1].toLowerCase() } : { kind: "error", message: body.error ?? "The decision could not be saved." };
  }
  if (body.success !== true) return { kind: "error", message: "The decision could not be confirmed." };
  if (body.status === "approved") return approve ? { kind: "approved", creditId: body.credit_id ?? null } : { kind: "error", message: "The database approved a claim that was meant to be declined." };
  if (body.status === "rejected") return approve ? { kind: "declined-already-claimed" } : { kind: "rejected" };
  return { kind: "error", message: "The decision could not be confirmed." };
}

/** Approves or declines one request. The note is stored with it, and the member can read it. */
export async function decideRoleClaim(requestId: string, approve: boolean, note: string): Promise<DecisionOutcome> {
  try {
    const { data, error } = await supabase.rpc(
      "decide_icdb_role_claim" as never,
      { p_request_id: requestId, p_approve: approve, p_note: note.trim().slice(0, 300) || null } as never,
    );
    return readDecisionAnswer(approve, error as Failure, data);
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : "The decision could not be saved." };
  }
}

/**
 * Tells the member what was decided, in the app. Best-effort (the decision is already saved). It never repeats a note that is not
 * meant for them, and it says plainly that an approved credit starts as the member's own claim, not as a verified one.
 */
export async function notifyRoleClaimDecision(view: RoleClaimView, outcome: DecisionOutcome, note: string): Promise<void> {
  const role = view.role?.role_title ?? "that role";
  const project = view.project?.title ?? "that project";
  if (outcome.kind === "approved") {
    await notifyUser({
      userId: view.request.requester_id,
      type: "role_claim_decision",
      category: "credits",
      title: "Your role claim was approved",
      message: `${role} on ${project} is now on your Passport. It starts as your own claim; ask a collaborator to co-sign it to back it up.`,
      actionUrl: "/profile",
      actionText: "Open your Passport",
    });
  } else if (outcome.kind === "rejected" || outcome.kind === "declined-already-claimed") {
    const reason = outcome.kind === "declined-already-claimed" ? "Someone else's claim to this role was approved first." : note.trim().slice(0, 160);
    await notifyUser({
      userId: view.request.requester_id,
      type: "role_claim_decision",
      category: "credits",
      title: "Your role claim wasn't approved",
      message: `We couldn't confirm your claim to ${role} on ${project}.${reason ? ` ${reason}` : ""}`,
      actionUrl: view.project ? `/credits/project/${view.project.id}` : "/credits",
      actionText: "View the project",
    });
  }
}

export type NameHint = "same" | "similar" | "different" | "unknown";

const tokens = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/**
 * How the name a role was credited under compares with the requester's profile name. It is shown to the reviewer as a hint and is
 * never used to approve anything: a matching name proves nothing about who someone is, and a different one can be a stage name.
 */
export function compareNames(credited: string | null | undefined, profileName: string | null | undefined): NameHint {
  const a = tokens(credited);
  const b = tokens(profileName);
  if (a.length === 0 || b.length === 0) return "unknown";
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === sb.size && [...sa].every((t) => sb.has(t))) return "same";
  const [small, large] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  // One name inside the other ("Plantier" and "Noé Plantier"): worth a second look either way, so it is neither "same" nor "different".
  return [...small].every((t) => large.has(t)) ? "similar" : "different";
}

/** Only http(s) addresses are ever linked or loaded as an image, whatever a member typed. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
