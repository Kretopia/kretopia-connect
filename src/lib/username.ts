/**
 * Canonical @username handle — single source of truth.
 *
 * profiles.username is BOTH the creator site handle and the sign-in handle.
 * There is no second username column and no second validation rule set:
 * every surface (Auth, Edit Profile, Creator Site settings, edge functions)
 * must use these helpers.
 *
 * Rules (product brief, Oct 2026):
 * - 3–30 chars, lowercase letters, numbers and underscore only
 * - cannot start or end with "_"
 * - reserved list blocked (app routes + brand terms)
 * - uniqueness is case-insensitive (handles are stored normalized lowercase)
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/**
 * Reserved handles. The brief's mandatory list is unioned with the app's
 * top-level routes so a handle can never shadow a real page (/:handle
 * resolves creator sites).
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Brief-mandated
  "auth", "admin", "api", "settings", "profile", "passport", "desk",
  "scout", "stages", "match", "circle", "site", "www", "support",
  // App routes / brand safety
  "login", "signup", "website-builder", "notifications", "messages",
  "discover", "wallet", "subscription", "spotlight", "magazine", "podcast",
  "fund", "ambassadors", "claim", "verify", "share", "terms", "privacy",
  "community", "kretopia", "thrive", "thrivein", "app", "root", "system",
]);

/** Strip leading "@", trim, lowercase — the only normalisation allowed. */
export const normalizeUsername = (raw: string): string =>
  (raw || "").trim().toLowerCase().replace(/^@+/, "");

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export type UsernameValidation = "ok" | "required" | "invalid" | "reserved";

/** Validate an ALREADY normalized handle. */
export const validateUsername = (normalized: string): UsernameValidation => {
  if (!normalized) return "required";
  if (
    !USERNAME_RE.test(normalized) ||
    normalized.startsWith("_") ||
    normalized.endsWith("_")
  ) {
    return "invalid";
  }
  if (RESERVED_USERNAMES.has(normalized)) return "reserved";
  return "ok";
};

export const usernameValidationMessage = (v: UsernameValidation): string | null => {
  switch (v) {
    case "ok":
      return null;
    case "required":
      return "Username is required";
    case "invalid":
      return "3–30 chars: lowercase letters, numbers or _ (not at the start or end)";
    case "reserved":
      return "That username is reserved";
  }
};
