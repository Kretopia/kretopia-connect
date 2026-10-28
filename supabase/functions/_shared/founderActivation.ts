// Founder Circle activation: the one place a paid Founder Circle Checkout Session becomes the `founder` tier.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: the purchase used to be activated only by `verify-founder-payment`, which only runs when the buyer lands
// back on /payment-success. A buyer who paid and closed the tab (or was signed out on return) kept a `pending` row
// and the free tier. And two concurrent verifications (two tabs, a double render) both read `pending`, both
// completed the row and both paid the bonus XP.
//
// Rules: a purchase is activated only from Stripe's own record of the session (paid, our type, the caller's id),
// the row is claimed with ONE conditional update (`status <> 'completed'`), so only one caller wins, and a failed
// entitlement write gives the claim back so the next attempt can finish the job.

export const FOUNDER_BONUS_XP = 5000;
export const FOUNDER_PRODUCT_ID = "prod_TzMqfksF7u6WBH";

// Minimal structural types, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type FounderSession = {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  payment_intent?: unknown;
  metadata?: Record<string, string> | null;
};

export type StripeSessions = { checkout: { sessions: { retrieve: (id: string) => Promise<FounderSession> } } };

export type FounderSessionCheck = { ok: true } | { ok: false; reason: "not_paid" | "wrong_type" | "wrong_user" };

/** Is this Stripe session a paid Founder Circle purchase made by `userId`? */
export function checkFounderSession(session: FounderSession, userId: string): FounderSessionCheck {
  if (session.payment_status !== "paid") return { ok: false, reason: "not_paid" };
  if (session.metadata?.type !== "founder_circle") return { ok: false, reason: "wrong_type" };
  if (session.metadata?.user_id !== userId) return { ok: false, reason: "wrong_user" };
  return { ok: true };
}

const paymentIntentId = (session: FounderSession): string | null =>
  typeof session.payment_intent === "string" ? session.payment_intent : null;

export type Activation = "activated" | "already_processed";

/**
 * Completes a verified, paid Founder Circle session for `userId`. Safe to call any number of times, from any
 * number of callers at once: exactly one call returns "activated" (and pays the bonus), the others
 * "already_processed". Throws when the purchase or the entitlement cannot be written, after giving the claim back.
 */
export async function activateFounderPurchase(db: Db, userId: string, session: FounderSession): Promise<Activation> {
  const now = new Date().toISOString();
  const intent = paymentIntentId(session);

  // The claim: Postgres re-checks `status <> 'completed'` on a concurrent update, so only one caller gets the row.
  const claim = await db
    .from("founder_circle_purchases")
    .update({ status: "completed", stripe_payment_intent_id: intent, purchased_at: now })
    .eq("stripe_session_id", session.id)
    .neq("status", "completed")
    .select("id");
  if (claim.error) throw new Error(`Could not record the Founder Circle purchase: ${claim.error.message}`);

  // create-founder-checkout's idempotency key returns the same session for a second click and inserts a second
  // pending row for it: each completed row is a taken spot, so keep one.
  if (claim.data && claim.data.length > 1) {
    try {
      const extra = (claim.data as { id: string }[]).slice(1).map((r) => r.id);
      await db.from("founder_circle_purchases").delete().in("id", extra);
    } catch (_e) {
      // best effort: the buyer's tier does not depend on it
    }
  }

  if (!claim.data || claim.data.length === 0) {
    const { data: row, error: readError } = await db
      .from("founder_circle_purchases")
      .select("status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (readError) throw new Error(`Could not read the Founder Circle purchase: ${readError.message}`);
    if (row?.status === "completed") return "already_processed";
    if (!row) {
      // The row written at checkout is missing (that insert failed): Stripe says it is paid, so record it now.
      const { error: insertError } = await db.from("founder_circle_purchases").insert({
        user_id: userId,
        stripe_session_id: session.id,
        stripe_payment_intent_id: intent,
        status: "completed",
        purchased_at: now,
      });
      if (insertError) throw new Error(`Could not record the Founder Circle purchase: ${insertError.message}`);
    }
  }

  const giveClaimBack = async () => {
    try {
      await db
        .from("founder_circle_purchases")
        .update({ status: "pending" })
        .eq("stripe_session_id", session.id)
        .eq("status", "completed");
    } catch (_e) {
      // best effort: the caller is already failing
    }
  };

  const profile = await db
    .from("profiles")
    .update({
      subscription_tier: "founder",
      subscription_status: "active",
      subscription_product_id: FOUNDER_PRODUCT_ID,
      subscription_end_date: null, // lifetime = no end date
    })
    .eq("user_id", userId);
  if (profile.error) {
    await giveClaimBack();
    throw new Error(`Could not activate the Founder Circle tier: ${profile.error.message}`);
  }

  // The bonus is best effort: the tier is what the buyer paid for, and the claim above means it is paid at most once.
  try {
    const { data: xpRow } = await db.from("profiles").select("xp").eq("user_id", userId).single();
    await db
      .from("profiles")
      .update({ xp: (xpRow?.xp || 0) + FOUNDER_BONUS_XP })
      .eq("user_id", userId);
    await db.from("xp_activities").insert({
      user_id: userId,
      activity_type: "founder_circle",
      xp_earned: FOUNDER_BONUS_XP,
      description: "Welcome to the Founder Circle! ⭕",
    });
  } catch (_e) {
    // not retried: see above
  }

  return "activated";
}

/**
 * For a buyer who paid but never came back to /payment-success: finishes their pending Founder Circle purchases
 * from Stripe's own record of each session. Returns true when one was activated. Never throws: it runs inside
 * `check-subscription`, which must keep working when Stripe or the database hiccups.
 *
 * A session Stripe reports as expired can no longer be paid, so its row is closed ('expired') instead of being
 * looked up on every later call.
 */
export async function recoverPendingFounderPurchase(db: Db, stripe: StripeSessions, userId: string): Promise<boolean> {
  try {
    const { data: pending, error } = await db
      .from("founder_circle_purchases")
      .select("id, stripe_session_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .not("stripe_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(3);
    if (error || !pending) return false;

    for (const row of pending as { stripe_session_id: string }[]) {
      const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id);
      if (session.status === "expired") {
        await db
          .from("founder_circle_purchases")
          .update({ status: "expired" })
          .eq("stripe_session_id", row.stripe_session_id)
          .eq("status", "pending");
        continue;
      }
      if (!checkFounderSession(session, userId).ok) continue;
      if ((await activateFounderPurchase(db, userId, session)) === "activated") return true;
    }
  } catch (_e) {
    return false;
  }
  return false;
}
