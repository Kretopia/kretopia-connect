import { supabase } from "@/integrations/supabase/client";

export interface OwnProfileWriteResult {
  ok: boolean;
  /** Set when `ok` is false. */
  message?: string;
}

/**
 * Writes to the signed-in owner's own profile row and only reports success when the database returned that row.
 *
 * `update(...).eq(...)` with no `.select()` answers "no error" even when row-level security matched zero rows, so a
 * blocked or mistargeted save would have read as "Profile updated". Asking for the row back turns that into a
 * visible failure, and the caller refetches from the same row, so what the owner sees after a save is what a
 * reload (and the public Passport) will show.
 */
export async function updateOwnProfile(userId: string, patch: Record<string, unknown>): Promise<OwnProfileWriteResult> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch as never)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "The change was not saved. Sign in again and retry." };
  return { ok: true };
}
