/**
 * Kretopia V1 — feature flag surface.
 *
 * Single source of truth for what's IN V1 vs HIDDEN.
 * "contextual: true" = code is loaded and reachable via deep-link but NOT
 * surfaced in primary navigation. This keeps existing infra alive without
 * polluting the daily-driver IA.
 *
 * Nothing here deletes code. To bring a hidden surface back into nav, flip
 * its `nav` flag to true.
 */

export const V1_ENABLED = {
  // Primary pillars — nav-visible
  passport: { on: true, nav: true, contextual: true },
  search: { on: true, nav: true, contextual: true },
  scout: { on: true, nav: true, contextual: true },
  kreto: { on: true, nav: true, contextual: true },
  thriveIN: { on: true, nav: true, contextual: true }, // desktop only in V1

  // Loop pillars — code kept, no primary nav (contextual only)
  krePay: { on: true, nav: false, contextual: true },
  studioLite: { on: true, nav: false, contextual: true },

  // Membership perks page (desktop nav)
  perks: { on: true, nav: true, contextual: true },
  settings: { on: true, nav: true, contextual: true },

  // Advanced surfaces we deliberately keep behind a flag in V1
  krePayAdvanced: { on: false, nav: false, contextual: true }, // escrow, milestones, contracts, deposits, intl payouts
} as const;

/**
 * Legacy surfaces — code retained, hidden from nav, onboarding, and home.
 * Deep-links still work behind `?legacy=1`.
 */
export const HIDDEN_V1 = {
  crews: true,
  creatorScore: true,
  agencyMode: false, // company/business tone is still respected — do not hide business logic
  communityFeed: true,
  fund: true,
  magazine: true, // still lives inside Kretopia, just no top-level nav
  events: true,   // Kretopia sub-surface
  dashboards: true,
  gamifiedScore: true,
  matchTab: true, // the old swipe surface — replaced by Kreto suggestions on Home
} as const;

export type V1Key = keyof typeof V1_ENABLED;
export type HiddenKey = keyof typeof HIDDEN_V1;

export function isV1(key: V1Key): boolean {
  return V1_ENABLED[key]?.on ?? false;
}

export function isInV1Nav(key: V1Key): boolean {
  const entry = V1_ENABLED[key];
  return !!(entry?.on && entry?.nav);
}

export function isHidden(key: HiddenKey): boolean {
  return HIDDEN_V1[key] ?? false;
}
