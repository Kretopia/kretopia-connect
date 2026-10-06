// One place for "invite someone to a Studio", used by every invite dialog.
//
// Why this exists: the dialogs each re-implemented the insert and drifted:
//  - the picked role went only into `agent_role` while `role` (what the
//    server's money/permission rules read) was always "member", so a Client
//    was treated like a Collaborator;
//  - nothing checked whether the person was already in the room or already
//    invited, so double invites piled up duplicate rows;
//  - the UI said "Invite sent!" even when the email never went out.
// No schema or RLS change: this only changes what the client writes and says.

export type InviteRole = "client" | "creative" | "collaborator";

/** `project_collaborators.role` only accepts member | client | creative | guest. */
export type StoredRole = "member" | "client" | "creative";

export const storedRoleFor = (role: InviteRole): StoredRole =>
  role === "client" ? "client" : role === "creative" ? "creative" : "member";

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Every distinct, lower-cased email found in free text (paste-friendly). */
export const extractEmails = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.match(EMAIL_RE) ?? []) {
    const email = normalizeEmail(match);
    if (!seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
};

export type InviteOutcome =
  /** A new invitation was saved. `emailSent` is only meaningful for email invites. */
  | { kind: "invited"; emailSent: boolean }
  /** The person is already in the room. Nothing was written. */
  | { kind: "already_member" }
  /** They already have an open invitation; for email invites it was sent again. */
  | { kind: "already_pending"; emailSent: boolean }
  | { kind: "error"; message: string };

interface MembershipRow {
  id: string;
  status: string | null;
}

// Deliberately loose: the real supabase client and a test double both fit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

interface BaseArgs {
  client: Client;
  projectId: string;
  role: InviteRole;
  inviterId: string;
}

const errorMessage = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : fallback;

async function findMembership(
  client: Client,
  projectId: string,
  by: { userId: string } | { email: string },
): Promise<MembershipRow | null> {
  let query = client.from("project_collaborators").select("id, status").eq("project_id", projectId);
  query = "userId" in by ? query.eq("user_id", by.userId) : query.eq("email", by.email);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(5);
  if (error) throw error;
  const rows: MembershipRow[] = data ?? [];
  // A live membership wins over an old, cancelled/declined row.
  return rows.find((r) => r.status === "accepted") ?? rows.find((r) => r.status === "pending") ?? rows[0] ?? null;
}

/** Re-inviting after a cancel/decline: drop the dead row so the new invite is a clean insert. */
async function clearDeadInvite(client: Client, row: MembershipRow | null): Promise<void> {
  if (!row || row.status === "accepted" || row.status === "pending") return;
  const { error } = await client.from("project_collaborators").delete().eq("id", row.id);
  if (error) throw error;
}

async function sendInvitationEmail(client: Client, projectId: string, email: string): Promise<boolean> {
  const { data, error } = await client.functions.invoke("send-project-invitation", {
    // The function re-derives project title and inviter name from the database.
    body: { email, projectId },
  });
  if (error) return false;
  return Boolean(data?.emailSent);
}

/** Invite by email address. The email always carries the Studio link. */
export async function inviteByEmail(args: BaseArgs & { email: string }): Promise<InviteOutcome> {
  const { client, projectId, role, inviterId } = args;
  const email = normalizeEmail(args.email);
  try {
    const existing = await findMembership(client, projectId, { email });
    if (existing?.status === "accepted") return { kind: "already_member" };
    if (existing?.status === "pending") {
      // Same address invited twice: don't add a second row, just send the email again.
      return { kind: "already_pending", emailSent: await sendInvitationEmail(client, projectId, email) };
    }
    await clearDeadInvite(client, existing);

    const { error } = await client.from("project_collaborators").insert({
      project_id: projectId,
      email,
      invited_by: inviterId,
      role: storedRoleFor(role),
      agent_role: role,
      status: "pending",
    });
    if (error) throw error;

    // The invitation is saved at this point; a failed email is reported, never hidden,
    // and can be re-sent from the pending list.
    return { kind: "invited", emailSent: await sendInvitationEmail(client, projectId, email) };
  } catch (e) {
    return { kind: "error", message: errorMessage(e, "Couldn't send the invitation.") };
  }
}

/** Invite someone who already has a Kretopia account (their Circle, a profile). */
export async function inviteMember(args: BaseArgs & { userId: string }): Promise<InviteOutcome> {
  const { client, projectId, role, inviterId, userId } = args;
  try {
    if (userId === inviterId) return { kind: "already_member" };
    const existing = await findMembership(client, projectId, { userId });
    if (existing?.status === "accepted") return { kind: "already_member" };
    if (existing?.status === "pending") return { kind: "already_pending", emailSent: false };
    await clearDeadInvite(client, existing);

    const { error } = await client.from("project_collaborators").insert({
      project_id: projectId,
      user_id: userId,
      email: null,
      invited_by: inviterId,
      role: storedRoleFor(role),
      agent_role: role,
      status: "pending",
    });
    if (error) throw error;
    // The in-app notification comes from the database trigger on this insert.
    return { kind: "invited", emailSent: false };
  } catch (e) {
    return { kind: "error", message: errorMessage(e, "Couldn't send the invitation.") };
  }
}

/** Toast copy for one outcome, so every dialog says the same honest thing. */
export function describeOutcome(
  outcome: InviteOutcome,
  who: string,
  via: "email" | "account",
): { title: string; description: string; variant?: "destructive" } {
  switch (outcome.kind) {
    case "invited":
      if (via === "account") {
        return { title: "Invitation sent", description: `${who} will see it in their notifications.` };
      }
      return outcome.emailSent
        ? { title: "Invitation sent", description: `An email with the Studio link is on its way to ${who}.` }
        : {
            title: "Invitation saved, email not sent",
            description: `We couldn't email ${who}. Use Resend in Pending invitations, or share the guest link.`,
            variant: "destructive",
          };
    case "already_member":
      return { title: "Already in this Studio", description: `${who} is already part of this Studio.` };
    case "already_pending":
      return via === "email" && outcome.emailSent
        ? { title: "Invitation sent again", description: `${who} already had an invitation, so we re-sent the email.` }
        : { title: "Already invited", description: `${who} already has a pending invitation.` };
    case "error":
      return { title: "Couldn't send the invitation", description: outcome.message, variant: "destructive" };
  }
}
