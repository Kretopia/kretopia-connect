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
  | "FEATURE_NEBIUS_INFERENCE"
  | "FEATURE_MINIMAX_INFERENCE";

function readFlag(flag: FeatureFlag): boolean {
  return import.meta.env[`VITE_${flag}`] === "true";
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return readFlag(flag);
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return readFlag(flag);
}
