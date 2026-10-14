// The Premium kick-off switch, server side. Pure and dependency-free.
//
// While PREMIUM_ENFORCED is false, a free-tier cap is not a tier gate: every
// account may use the AI features that were limited for free accounts, up to a
// fixed safety ceiling that is the same for everyone and is NOT a tier (it
// exists so that a loop or a script cannot spend the provider's credits without
// bound). Paid tiers are untouched: an unlimited cap stays unlimited and a cap
// that is already higher than the ceiling stays as it is.
//
// At the Premium kick-off, set PREMIUM_ENFORCED to true here AND in
// src/lib/premiumSwitch.ts (the browser has its own copy: a client constant
// cannot be trusted by an edge function), then paste the changed functions.
//
// Not covered by this switch (database triggers and RPCs, which need an approved
// migration): the portfolio item limit, the storage quota and the monthly
// opportunity posting cap. They are listed in
// docs/roadmap/premium-switch-evidence.md.

export const PREMIUM_ENFORCED = false;

/** Safety ceilings while Premium is not enforced. Not tiers. */
export const ABUSE_CEILING_DAILY_MESSAGES = 500;
export const ABUSE_CEILING_DAILY_GENERATIONS = 200;

/**
 * The daily cap to enforce for a feature whose tier cap is `tierCap`
 * (`-1` means unlimited).
 */
export function dailyCapFor(tierCap: number, ceiling: number, enforced: boolean = PREMIUM_ENFORCED): number {
  if (enforced) return tierCap;
  if (tierCap === -1) return -1;
  return Math.max(tierCap, ceiling);
}

/** Whether to treat the caller as Pro-level for feature gating. */
export function effectiveIsPro(isPro: boolean, enforced: boolean = PREMIUM_ENFORCED): boolean {
  return enforced ? isPro : true;
}
