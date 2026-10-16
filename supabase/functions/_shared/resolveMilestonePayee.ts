// Resolves who should actually be PAID for a milestone -- deliberately
// distinct from `milestones.created_by`, which only means "who inserted this
// row" (an audit-trail column, still correct for that everywhere it is read
// outside the payout path).
//
// THE BUG THIS FIXES: payout code used to read `milestone.created_by` as "the
// Creator to pay". That holds when the Creator inserts their own milestone
// (RequestPaymentCard: a collaborator asks to be paid), but on the main path
// -- a Brand creating a milestone from MilestoneBoard -- created_by is the
// BRAND's own id. Money was then recorded as paid to the payer: `paid_to`,
// a "paid" invoice from the Brand to itself, a "Payment received" notice
// sent to the Brand, and the manager commission filed under the Brand.
//
// A first version resolved the Creator from the project's collaborators, but
// when it could not decide (no creative on the project, or several) it fell
// back to `created_by` -- the same wrong answer, now with a warning in a log.
// This version never falls back to a guess. It returns `null` and the callers
// either ask the payer (before any money moves) or, for money already in
// flight, record the payment without crediting anyone.
//
// Who can be the payee, in order (the payer is never one):
//   1. `chosenUserId`: the payee the payer explicitly picked at checkout,
//      carried in Stripe metadata. Honoured only if it is a current candidate
//      (checkout) or `trustChosen` is set (webhook/capture: that metadata was
//      written by create-milestone-payment and signed by Stripe).
//   2. `requested_by`: the creative who asked to be paid.
//   3. `created_by`, when it is not on the project's owner side: the creative
//      inserted their own row.
//   4. `created_by`, when it IS the project owner but the payer is the
//      project's separate client: a creative-run Studio paid by its client.
//   5. The single accepted collaborator who is not an owner, client or guest.
//   6. Otherwise `null` (no creative yet, or more than one).
export type PayeeSource =
  | "chosen"
  | "requested_by"
  | "created_by"
  | "owner_paid_by_client"
  | "sole_collaborator"
  | "unresolved";

export interface ResolvedMilestonePayee {
  /** The user to credit, or null when it cannot be determined with confidence. */
  payeeUserId: string | null;
  /** true exactly when `payeeUserId` is null. */
  ambiguous: boolean;
  /** Accepted, non-owner, non-client/guest collaborators other than the payer. */
  candidateUserIds: string[];
  candidateCount: number;
  source: PayeeSource;
}

export interface PayeeDecisionInput {
  milestone: { created_by: string; requested_by?: string | null };
  project: { created_by?: string | null; client_user_id?: string | null } | null;
  collaborators: { user_id: string | null; role: string | null }[];
  /** Who is paying. Never credited as the payee. */
  payerUserId?: string | null;
  chosenUserId?: string | null;
  /** The choice came from our own signed checkout metadata, not from a request body. */
  trustChosen?: boolean;
}

const MONEY_BLIND_ROLES = new Set(["client", "guest"]);

/** Pure decision, no I/O: see the rules at the top of this file. */
export function decidePayee(input: PayeeDecisionInput): ResolvedMilestonePayee {
  const { milestone, project, payerUserId, chosenUserId, trustChosen } = input;
  const ownerIds = new Set<string>(
    [project?.created_by, project?.client_user_id].filter(Boolean) as string[],
  );

  const candidateUserIds = Array.from(
    new Set(
      (input.collaborators || [])
        .filter(
          (c) =>
            !!c.user_id &&
            c.user_id !== payerUserId &&
            !ownerIds.has(c.user_id) &&
            !MONEY_BLIND_ROLES.has(c.role || ""),
        )
        .map((c) => c.user_id as string),
    ),
  );

  const result = (payeeUserId: string | null, source: PayeeSource): ResolvedMilestonePayee => ({
    payeeUserId,
    ambiguous: payeeUserId === null,
    candidateUserIds,
    candidateCount: candidateUserIds.length,
    source,
  });
  const notThePayer = (id?: string | null): id is string => !!id && id !== payerUserId;

  if (notThePayer(chosenUserId) && (trustChosen || candidateUserIds.includes(chosenUserId))) {
    return result(chosenUserId, "chosen");
  }
  if (notThePayer(milestone.requested_by) && !ownerIds.has(milestone.requested_by)) {
    return result(milestone.requested_by, "requested_by");
  }
  if (notThePayer(milestone.created_by) && !ownerIds.has(milestone.created_by)) {
    return result(milestone.created_by, "created_by");
  }
  if (
    notThePayer(milestone.created_by) &&
    milestone.created_by === project?.created_by &&
    !!payerUserId &&
    payerUserId === project?.client_user_id
  ) {
    return result(milestone.created_by, "owner_paid_by_client");
  }
  if (candidateUserIds.length === 1) {
    return result(candidateUserIds[0], "sole_collaborator");
  }
  return result(null, "unresolved");
}

type AdminClient = {
  from: (table: string) => any;
};

export interface ResolvePayeeOptions {
  payerUserId?: string | null;
  chosenUserId?: string | null;
  trustChosen?: boolean;
}

export async function resolveMilestonePayee(
  supabaseAdmin: AdminClient,
  milestone: { created_by: string; project_id: string; requested_by?: string | null },
  opts: ResolvePayeeOptions = {},
): Promise<ResolvedMilestonePayee> {
  const [{ data: project }, { data: collaborators }] = await Promise.all([
    supabaseAdmin
      .from("projects")
      .select("created_by, client_user_id")
      .eq("id", milestone.project_id)
      .maybeSingle(),
    supabaseAdmin
      .from("project_collaborators")
      .select("user_id, role")
      .eq("project_id", milestone.project_id)
      .eq("status", "accepted"),
  ]);

  return decidePayee({
    milestone,
    project: project ?? null,
    collaborators: collaborators || [],
    payerUserId: opts.payerUserId,
    chosenUserId: opts.chosenUserId,
    trustChosen: opts.trustChosen,
  });
}

/**
 * The notice for the PAYER when a payment is recorded but nobody could be
 * credited. It asks for a person to look at it; it does not claim a payee.
 */
export function unattributedPaymentNotice(args: {
  payerUserId: string;
  milestoneTitle: string;
  projectId: string;
  amount?: number | null;
}) {
  const link = `/desk/${args.projectId}?tab=finance`;
  const amount = typeof args.amount === "number" && Number.isFinite(args.amount) ? `$${args.amount.toFixed(2)} ` : "";
  return {
    user_id: args.payerUserId,
    title: "Payment received — creative not identified",
    message: `Your ${amount}payment for "${args.milestoneTitle}" went through, but we couldn't tell which creative it is for, so no one has been credited yet. Contact support with this milestone so it can be assigned.`,
    type: "alert",
    category: "payment",
    priority: "high",
    link,
    action_url: link,
    action_text: "View milestone",
  };
}
