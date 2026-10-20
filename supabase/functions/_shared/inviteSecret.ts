// The secret in an emailed project-invitation link. The link carries the secret; the pending invitation stores
// only its SHA-256 hash (hex), which get_or_create_guest_token_for_invite compares with
// encode(digest(secret, 'sha256'), 'hex'). Reading the table therefore never reveals a usable secret.

/** 24 random bytes as base64url: 192 bits, URL-safe without escaping. */
export function newInviteSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lowercase hex SHA-256, the same format Postgres' encode(digest(..., 'sha256'), 'hex') produces. */
export async function hashInviteSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** How long a preview token minted for an invitation stays valid. Matches the database function. */
export const INVITE_PREVIEW_TOKEN_DAYS = 14;
