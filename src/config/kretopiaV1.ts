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

/**
 * Preview-only flags for in-progress surfaces (Phase 5.4 — HoloCard +
 * Scout fit explanations). Both default to false: the props/slots they
 * gate already exist on the relevant cards, but the features themselves
 * (holographic rendering, AI-generated fit copy) aren't built yet.
 * Flip individually once each is ready to show, without needing to
 * touch every call site again.
 */
export const PREVIEW_FLAGS = {
  enableHoloPreview: false,
  enableFitExplanationPreview: false,
  /** Studio Work Room "Preview as client" (CPO Studio Blueprint + UX
   *  Spec v0.1 §14-15) -- shows what a scoped client/guest would see
   *  before a link is sent. Off until the underlying guest-access scope
   *  is tightened: today's review/guest-token RPCs (list_share_link_files,
   *  get_guest_files) return every project file regardless of what's
   *  "shared," so a real preview would currently show more than the
   *  client actually gets. See STUDIO_OVERHAUL findings -- flagged, not
   *  guessed. */
  enableClientPreview: false,
  /** Studio versioned approvals (CPO spec §13) -- approval bound to an
   *  exact deliverable version + reviewer + timestamp. The schema for
   *  this (deliverable_versions) already exists but has zero real
   *  callers; today's Approve action writes reviewed_by/reviewed_at onto
   *  the mutable deliverable row itself, not a version id. Off until
   *  that wiring is built and validated. */
  enableVersionedApprovals: false,
} as const;
