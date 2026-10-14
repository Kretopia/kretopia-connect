/**
 * The Premium kick-off switch, client side.
 *
 * While `PREMIUM_ENFORCED` is false, every feature that is gated by a
 * subscription tier or by a free-tier monthly cap behaves as unlocked: Kretopia
 * is free to use until the owners decide to start Premium. The paid products,
 * prices and checkout are untouched; only the gate answers "yes".
 *
 * At the Premium kick-off, set it to true here AND in
 * `supabase/functions/_shared/premiumSwitch.ts` (the server has its own copy:
 * a browser constant cannot be trusted by an edge function).
 *
 * This is not an abuse control. Rate limits, cooldowns, token ceilings and the
 * server-side safety ceilings are not tiers and are not controlled here.
 */
export const PREMIUM_ENFORCED = false;
