/**
 * Member-initiated account deletion.
 *
 * The browser must never use the Supabase admin API: it needs the service-role key and production answers
 * 403 `not_admin`. Deletion goes through `public.delete_my_account()` (SECURITY DEFINER, acts only on `auth.uid()`),
 * installed from `docs/security/account/D1_delete_my_account/`. Both Settings surfaces share this helper so their
 * behaviour cannot drift.
 */
import { supabase } from "@/integrations/supabase/client";

export const DELETE_ACCOUNT_FAILED_TITLE = "Failed to delete account";

/** Plain-language reason for a failed deletion; never echoes raw database text to the member. */
export function deleteAccountFailureMessage(error: unknown): string {
  const text = [
    (error as { message?: unknown } | null)?.message,
    (error as { code?: unknown } | null)?.code,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ");

  if (text.includes("account_delete_blocked")) {
    return "Some of your records still need to be handled by our team before your account can be deleted. Please contact support.";
  }
  if (text.includes("not_authenticated") || text.includes("account_not_found")) {
    return "Your session has expired. Please sign in again, then retry.";
  }
  return "Please contact support if this issue persists";
}

/**
 * Deletes the signed-in member's own account, then clears the local session.
 * Throws if the server refuses; in that case the member stays signed in and nothing is signed out.
 */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;

  // Local only: the login is gone, so a server-side sign-out would just fail. The account is already deleted at this
  // point, so a storage hiccup here must not turn a successful deletion into an error toast.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* the session token is already useless: the user row no longer exists */
  }
}
