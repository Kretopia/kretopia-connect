// Creative Passport migration — feature flag registry.
// Every flag defaults to false. Nothing reads these yet; adding one here
// changes no existing behavior until a call site opts in explicitly.

export type FeatureFlag =
  | "FEATURE_SEARCH_V2"
  | "FEATURE_CREATIVE_RECORD"
  | "FEATURE_DISCOVERIES_V2"
  | "FEATURE_PASSPORT_REVEAL"
  | "FEATURE_AI_DRAFTS"
  | "FEATURE_ACTIVATION_CENTER_V2"
  | "FEATURE_RECOMMENDATIONS"
  | "FEATURE_OPPORTUNITIES_V2"
  // Pilot, off until product approval: the owner's one deterministic next move (Passport Live -> First Proof -> Co-Signed).
  | "FEATURE_PILOT_NEXT_MOVE"
  // Off until kretopia-app seats paid Stage buyers (its verify-stage-ticket, 2026-11-25): while off, no paid Stage ticket is
  // sold, so nobody is charged for a seat they would not get. Turn on with VITE_FEATURE_PAID_STAGE_TICKETS=true.
  | "FEATURE_PAID_STAGE_TICKETS";

function readFlag(flag: FeatureFlag): boolean {
  return import.meta.env[`VITE_${flag}`] === "true";
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return readFlag(flag);
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return readFlag(flag);
}
