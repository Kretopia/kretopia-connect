import { V1_ENABLED, HIDDEN_V1, type V1Key, type HiddenKey } from "@/config/kretopiaV1";

/**
 * Single read point for V1 flag decisions. Prefer this over importing the
 * config directly so we can wire remote overrides later without a refactor.
 */
export function useV1Flag() {
  return {
    on: (key: V1Key) => V1_ENABLED[key]?.on ?? false,
    inNav: (key: V1Key) => {
      const e = V1_ENABLED[key];
      return !!(e?.on && e?.nav);
    },
    contextual: (key: V1Key) => !!V1_ENABLED[key]?.contextual,
    hidden: (key: HiddenKey) => HIDDEN_V1[key] ?? false,
  };
}
