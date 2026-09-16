// Shared escrow authorization helper.
// A capture/cancel of an escrowed Stripe PaymentIntent may only be performed by
// the party that actually funded it (the payer recorded on the PaymentIntent
// metadata) or, when no payer metadata exists, the project's paying client /
// project owner. Everyone else is rejected before any Stripe call.

type AdminClient = {
  from: (t: string) => any;
};

export type MilestoneRow = {
  id: string;
  project_id: string;
  created_by: string;
  payment_intent_id: string | null;
  status: string;
  escrow_status: string | null;
  paid_at: string | null;
  [k: string]: any;
};

export class EscrowAuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

function payerFromMetadata(metadata: Record<string, string> | undefined | null): string | null {
  if (!metadata) return null;
  return metadata.payer_id || metadata.userId || metadata.payerId || null;
}

/**
 * Verifies `userId` is allowed to release/cancel escrow for `milestone`.
 * Throws EscrowAuthError otherwise.
 */
export async function assertCanReleaseMilestone(
  admin: AdminClient,
  milestone: MilestoneRow,
  userId: string,
  paymentIntentMetadata?: Record<string, string> | null,
): Promise<void> {
  const metaPayer = payerFromMetadata(paymentIntentMetadata);
  if (metaPayer) {
    if (metaPayer !== userId) {
      throw new EscrowAuthError("You are not the payer for this milestone");
    }
    return;
  }

  const { data: project } = await admin
    .from("projects")
    .select("id, created_by, client_user_id")
    .eq("id", milestone.project_id)
    .maybeSingle();

  if (!project) throw new EscrowAuthError("Project not found", 404);

  const allowed = [project.client_user_id, project.created_by].filter(Boolean);
  if (!allowed.includes(userId)) {
    throw new EscrowAuthError("You are not authorized to release this payment");
  }
}

/** Loads the milestone and enforces the payment intent actually belongs to it. */
export async function loadMilestoneForIntent(
  admin: AdminClient,
  milestoneId: string,
  paymentIntentId: string,
): Promise<MilestoneRow> {
  const { data, error } = await admin
    .from("milestones")
    .select("*, projects(id, title, created_by, client_user_id)")
    .eq("id", milestoneId)
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (error) throw new EscrowAuthError(`Failed to load milestone: ${error.message}`, 400);
  if (!data) throw new EscrowAuthError("Milestone not found for this payment", 404);
  return data as MilestoneRow;
}
