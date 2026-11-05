import { supabase } from "@/integrations/supabase/client";
import { normalizeUsername, validateUsername, usernameValidationMessage } from "@/lib/username";

export class UsernameTakenError extends Error {
  constructor() {
    super("That @handle is already taken. Choose another to continue.");
    this.name = "UsernameTakenError";
  }
}

export function isUsernameConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return value.code === "23505" && Boolean(value.message?.includes("profiles_username_key"));
}

export async function isOnboardingUsernameTaken(username: string, userId: string) {
  const { data, error } = await supabase.from("public_profiles_safe")
    .select("user_id")
    .ilike("username", normalizeUsername(username).replace(/_/g, "\\_"))
    .neq("user_id", userId)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

/** Preflight avoids known collisions; the unique constraint wins concurrent claims. */
export async function claimOnboardingUsername(userId: string, raw: string) {
  const username = normalizeUsername(raw);
  const validation = validateUsername(username);
  if (validation !== "ok") throw new Error(usernameValidationMessage(validation) ?? "Invalid @handle");
  if (await isOnboardingUsernameTaken(username, userId)) throw new UsernameTakenError();
  const { data, error } = await supabase.from("profiles")
    .update({ username }).eq("user_id", userId).select("user_id, username").single();
  if (isUsernameConflict(error)) throw new UsernameTakenError();
  if (error) throw error;
  if (data?.user_id !== userId || data.username !== username) {
    throw new Error("Your @handle could not be saved. Please retry.");
  }
  return username;
}