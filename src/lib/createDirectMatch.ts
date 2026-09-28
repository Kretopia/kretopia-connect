import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a creator match with another user. Uses the create_direct_match
 * RPC when the backend has it; the production backend predates that RPC,
 * so fall back to a direct insert (allowed by its current policies).
 * Never throws — a failed match must not break sign-up/onboarding.
 */
export async function createDirectMatch(otherUserId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc("create_direct_match" as any, { _other_user_id: otherUserId });
    if (!error) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id === otherUserId) return;
    const { error: insertError } = await supabase
      .from("matches")
      .insert({ user1_id: user.id, user2_id: otherUserId, match_type: "creator", status: "active" } as any);
    if (insertError) console.warn("[createDirectMatch] fallback insert failed", insertError.message);
  } catch (e) {
    console.warn("[createDirectMatch] failed", e);
  }
}
