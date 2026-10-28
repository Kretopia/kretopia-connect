// The credit a visitor claimed before signing up ("this is my credit"), attached to their new account.
//
// AuthContext used to take the claim out of sessionStorage, then insert it with verification_status 'manual'.
// credits_verification_status_check has never allowed 'manual', so that insert was rolled back every time, the
// error was not read, and the log line said "Auto-attached": the claim was dropped without a word. Now the status is
// one the table allows ('pending_review', the same one ProfileActivationGate files for a claim), the insert's error
// is read, a claim that could not be attached stays in sessionStorage for the next sign-in, and a claim that is
// already attached is not attached twice.

export const PENDING_CLAIM_KEY = "thrivein_pending_claim";

// Minimal structural types, so this stays testable without a Supabase client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ClaimResult = "none" | "attached" | "already_attached" | "failed";

export async function attachPendingCreditClaim(db: Db, userId: string, storage: Store): Promise<ClaimResult> {
  const raw = storage.getItem(PENDING_CLAIM_KEY);
  if (!raw) return "none";

  let claim: { project_name?: string; role?: string };
  try {
    claim = JSON.parse(raw);
  } catch {
    storage.removeItem(PENDING_CLAIM_KEY); // unreadable: nothing to retry
    return "none";
  }
  const projectName = claim.project_name?.trim();
  if (!projectName) {
    storage.removeItem(PENDING_CLAIM_KEY);
    return "none";
  }
  const role = claim.role || "Contributor";

  const { data: existing, error: lookupError } = await db
    .from("credits")
    .select("id")
    .eq("user_id", userId)
    .eq("project_name", projectName)
    .eq("role", role)
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    console.error("[pendingCreditClaim] Could not check the pending credit claim:", lookupError.message);
    return "failed"; // kept in storage: the next sign-in tries again
  }
  if (existing) {
    storage.removeItem(PENDING_CLAIM_KEY);
    return "already_attached";
  }

  const { error } = await db.from("credits").insert({
    user_id: userId,
    project_name: projectName,
    role,
    verification_status: "pending_review",
  });
  if (error) {
    console.error("[pendingCreditClaim] Could not attach the pending credit claim:", error.message);
    return "failed";
  }

  storage.removeItem(PENDING_CLAIM_KEY);
  return "attached";
}
