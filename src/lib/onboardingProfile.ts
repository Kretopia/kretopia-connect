import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/legacyTypes";

export const ONBOARDING_PASSPORT_PATH = "/profile";

/** An UPDATE without returned rows can succeed without saving any profile. */
export async function saveOnboardingProfile(userId: string, fields: Database["public"]["Tables"]["profiles"]["Update"]) {
  const { data, error } = await supabase.from("profiles")
    .update(fields)
    .eq("user_id", userId)
    .select("user_id, onboarding_completed")
    .single();

  if (error) throw error;
  if (data?.user_id !== userId || data.onboarding_completed !== true) {
    throw new Error("Your profile could not be saved. Please sign in again and retry.");
  }
  return data;
}