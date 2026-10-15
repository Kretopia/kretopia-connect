// Pure checks and one registry-free atomic claim for event ticket checkout.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: `checkout-event-tickets` read a promo code's `uses_count`, compared it
// with `max_uses`, and incremented it later (for a free ticket, after the
// grant; for a paid one, at payment confirmation). Two requests in the same
// moment both passed the check, so a single-use code could grant several free
// tickets, and many buyers could start a discounted checkout with a code that
// had one use left. The quantity was only range-checked, so 1.5 and NaN passed
// and a fractional "number of tickets" reached the capacity and price maths.
//
// Rules:
//   - a quantity is an integer from 1 to 50;
//   - a free grant claims its promo use atomically (compare-and-set on
//     `uses_count`) BEFORE it grants, and gives the use back if the grant fails;
//   - a paid checkout does not consume a use until payment, but pending orders
//     that started in the last 30 minutes count against the code, so a code
//     with one use left is not handed to everyone who opens checkout together;
//   - a count or claim that cannot be read is not "room": it refuses.

export const MAX_TICKETS_PER_ORDER = 50;
export const PENDING_ORDER_HOLD_MINUTES = 30;

/** An integer from 1 to 50, or null. A numeric string is not a number here. */
export function cleanQuantity(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= MAX_TICKETS_PER_ORDER ? raw : null;
}

/**
 * Is there room for one more use? `inFlight` = pending orders holding the code.
 * An unreadable in-flight count (null) is no room.
 */
export function promoHasRoom(input: { maxUses: number | null | undefined; usesCount: number; inFlight: number | null }): boolean {
  if (input.maxUses === null || input.maxUses === undefined) return true;
  if (input.inFlight === null) return false;
  return input.usesCount + input.inFlight < input.maxUses;
}

// Minimal structural type of the service-role client, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type PromoClaim = "claimed" | "exhausted" | "error";

/**
 * Takes one use of a promo code by compare-and-set on `uses_count`: the update only applies if the
 * count is still the one that was read, so two concurrent claims cannot both take the last use.
 * Retries a few times when it loses the race.
 */
export async function claimPromoUse(db: Db, promoId: string, attempts = 4): Promise<PromoClaim> {
  for (let i = 0; i < attempts; i++) {
    const { data: row, error } = await db
      .from("event_promo_codes")
      .select("uses_count, max_uses")
      .eq("id", promoId)
      .maybeSingle();
    if (error || !row) return "error";
    const used = Number(row.uses_count);
    if (!Number.isFinite(used)) return "error";
    if (row.max_uses !== null && row.max_uses !== undefined && used >= Number(row.max_uses)) return "exhausted";

    const { data: won, error: updErr } = await db
      .from("event_promo_codes")
      .update({ uses_count: used + 1 })
      .eq("id", promoId)
      .eq("uses_count", used)
      .select("id");
    if (updErr) return "error";
    if (Array.isArray(won) && won.length > 0) return "claimed";
    // Someone else took a use between the read and the write: read again.
  }
  return "error";
}

/** Gives a claimed use back (compare-and-set, best effort: it never goes below zero). */
export async function releasePromoUse(db: Db, promoId: string): Promise<void> {
  const { data: row } = await db.from("event_promo_codes").select("uses_count").eq("id", promoId).maybeSingle();
  const used = Number(row?.uses_count);
  if (!Number.isFinite(used) || used <= 0) return;
  await db.from("event_promo_codes").update({ uses_count: used - 1 }).eq("id", promoId).eq("uses_count", used);
}
