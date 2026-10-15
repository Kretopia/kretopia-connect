// Pure request and selection checks for `batch-milestone-payout`.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why (see docs/roadmap/batch-milestone-payout-evidence.md):
//  - The batch function released escrow on the project-level rule only
//    ("the project's client or creator"), while `capture-milestone-payment`
//    additionally binds the release to the payer recorded on the
//    PaymentIntent. The batch door was the weaker one.
//  - Its second branch created ONE Checkout session for all completed,
//    non-escrow milestones on the platform account (no destination, no
//    `kind` metadata). `stripe-marketplace-webhook` dispatches on
//    `metadata.kind` and `milestoneId`, so such a session is never
//    reconciled: the client is charged, no milestone is marked paid and no
//    creator is paid. That branch is no longer offered; milestones that are
//    not in escrow are paid one at a time (`create-milestone-payment`).

export const MAX_BATCH_MILESTONES = 50;

export type BatchRequest =
  | { ok: true; projectId: string; milestoneIds: string[] }
  | { ok: false; error: string };

export function cleanBatchRequest(body: unknown): BatchRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const projectId = b.projectId;
  const ids = b.milestoneIds;
  if (typeof projectId !== "string" || !projectId || !Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Missing projectId or milestoneIds" };
  }
  if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
    return { ok: false, error: "Invalid milestoneIds" };
  }
  const unique = Array.from(new Set(ids as string[]));
  if (unique.length > MAX_BATCH_MILESTONES) {
    return { ok: false, error: `At most ${MAX_BATCH_MILESTONES} milestones per request` };
  }
  return { ok: true, projectId, milestoneIds: unique };
}

export interface MilestoneLike {
  id: string;
  status?: string | null;
  escrow_status?: string | null;
  payment_intent_id?: string | null;
  paid_at?: string | null;
}

export interface MilestonePartition<T extends MilestoneLike> {
  /** funds are held in escrow and the work is in review: the payer may release them */
  capturable: T[];
  /** completed, no escrow, unpaid: these used to go to a combined checkout that nothing reconciles */
  notAvailable: T[];
}

export function partitionMilestones<T extends MilestoneLike>(rows: T[] | null | undefined): MilestonePartition<T> {
  const capturable: T[] = [];
  const notAvailable: T[] = [];
  for (const m of rows ?? []) {
    if (m.escrow_status === "authorized" && m.payment_intent_id && m.status === "review") {
      capturable.push(m);
    } else if (m.status === "completed" && m.escrow_status === "none" && !m.paid_at) {
      notAvailable.push(m);
    }
  }
  return { capturable, notAvailable };
}
