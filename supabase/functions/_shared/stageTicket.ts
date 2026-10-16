// Shared entry rules for curated stages: who may take a seat, by RSVP or by paid ticket.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: `rsvp-curated-stage` only seats someone in a PRIVATE stage if they are the host, hold the stage's
// invite token or were invited by email. The paid path had no such gate: `checkout-stage-ticket` sold a
// ticket for any paid stage to anyone who knew its id, and `verify-stage-ticket` then wrote the RSVP, so a
// private paid stage could be entered by paying, bypassing the invitation. The paid path also had no
// "already has a ticket" check beyond a 24-hour Stripe idempotency window, did not check that the session
// it verified was a stage-ticket session, left a paid session with no order row when the pending-order
// insert had failed, and answered `paid: true` when the RSVP write failed.
//
// Rule: both paths use the same entry decision. A paid session records that the entry rule was applied
// when it was created (`metadata.entry_checked`); `verify-stage-ticket` seats a buyer in a private stage
// only if that was so, or if the buyer is the host or is invited by email.

// Minimal structural type of the service-role client, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export interface StageForEntry {
  id: string;
  visibility?: string | null;
  invite_token?: string | null;
  host_user_id?: string | null;
}

export interface EntryInput {
  visibility?: string | null;
  hostUserId?: string | null;
  userId: string;
  inviteToken?: string | null; // what the visitor presented
  stageInviteToken?: string | null; // what the stage holds
  invitedByEmail: boolean;
}

/** The decision, with no I/O. A stage that is not private is open; a private one needs the host, the token or an invitation. */
export function decideStageEntry(i: EntryInput): boolean {
  if (i.visibility !== "private") return true;
  if (i.hostUserId && i.hostUserId === i.userId) return true;
  if (i.inviteToken && i.stageInviteToken && i.inviteToken === i.stageInviteToken) return true;
  return i.invitedByEmail;
}

/** The decision with the one lookup it may need (an invitation by email). A lookup that fails is a refusal. */
export async function canEnterStage(
  admin: Db,
  stage: StageForEntry,
  user: { id: string; email?: string | null },
  inviteToken?: string | null,
): Promise<boolean> {
  const base = {
    visibility: stage.visibility,
    hostUserId: stage.host_user_id,
    userId: user.id,
    inviteToken,
    stageInviteToken: stage.invite_token,
  };
  if (decideStageEntry({ ...base, invitedByEmail: false })) return true;
  if (stage.visibility !== "private") return false;

  const email = (user.email || "").toLowerCase();
  if (!email) return false;
  const { data, error } = await admin
    .from("curated_stage_invites")
    .select("id")
    .eq("stage_id", stage.id)
    .ilike("email", likeLiteral(email))
    .neq("status", "revoked")
    .maybeSingle();
  if (error) return false;
  return decideStageEntry({ ...base, invitedByEmail: !!data });
}

/**
 * An email as a LIKE pattern that matches only itself (case-insensitively, with ilike): `_` and `%` in an
 * address are literal characters, not wildcards. Without this an address such as `a_b@x.com` also matched
 * an invitation sent to `aXb@x.com`.
 */
export function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** A buyer who already holds a seat or a paid order does not buy again. */
export function alreadyHasTicket(rsvpStatus: string | null | undefined, paidOrders: number): boolean {
  return rsvpStatus === "rsvp" || rsvpStatus === "attended" || paidOrders > 0;
}

export const STAGE_TICKET_KIND = "curated_stage";

/** True for a Checkout session that this program created for a stage ticket. */
export function isStageTicketSession(metadata: Record<string, string> | null | undefined): boolean {
  return metadata?.kind === STAGE_TICKET_KIND && !!metadata?.stage_id && !!metadata?.user_id;
}

/** Whether a paid session was created after the entry rule was applied (see the header). */
export function entryWasChecked(metadata: Record<string, string> | null | undefined): boolean {
  return metadata?.entry_checked === "1";
}
