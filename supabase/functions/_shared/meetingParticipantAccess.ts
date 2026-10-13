// Pure, dependency-free decision for "may this recorded meeting participant be
// handed a meeting token". Imported by edge functions (Deno) and by tests
// (Vite), so it must not import anything or touch the network.
//
// Rule (code-only, no schema): a participant row grants a token only while its
// status is one of the statuses that mean "this person is, or may become,
// present". A host revoking someone sets 'denied' or 'removed'; those rows,
// and any status this helper does not know, grant nothing (fail closed).
//
// The column's CHECK (supabase/migrations/20260512184606_*) allows exactly:
//   invited, knocking, joined, left, denied, removed.
// 'left' stays allowed on purpose: someone who stepped out may come back.
// 'knocking' stays allowed to keep today's lobby flow working; tightening it
// is a product decision, not part of this gate.

export const REVOKED_PARTICIPANT_STATUSES = ["denied", "removed"] as const;

const TOKEN_ELIGIBLE_STATUSES: readonly string[] = ["invited", "knocking", "joined", "left"];

export interface ParticipantRowLike {
  status?: string | null;
}

export function participantMayMint(row: ParticipantRowLike | null | undefined): boolean {
  const status = row?.status;
  if (typeof status !== "string") return false;
  return TOKEN_ELIGIBLE_STATUSES.includes(status);
}
