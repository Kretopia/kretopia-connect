import { supabase } from "@/integrations/supabase/client";

export type StreakType = "login" | "copilot" | "profile_update";

export interface StreakRow {
  current_streak: number;
  longest_streak: number;
  last_action_date: string | null;
}

/**
 * Bumps the caller's daily streak for a given type. Fire-and-forget safe.
 */
export async function bumpStreak(type: StreakType): Promise<StreakRow | null> {
  try {
    const { data, error } = await supabase.rpc("bump_streak", { _streak_type: type });
    if (error) {
      console.warn("[streaks] bump failed:", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row as StreakRow | null;
  } catch (err) {
    console.warn("[streaks] exception:", err);
    return null;
  }
}

export async function getStreaks(userId: string): Promise<Record<StreakType, StreakRow | null>> {
  const out: Record<StreakType, StreakRow | null> = {
    login: null,
    copilot: null,
    profile_update: null,
  };
  try {
    const { data } = await supabase
      .from("daily_streaks")
      .select("streak_type, current_streak, longest_streak, last_action_date")
      .eq("user_id", userId);
    (data || []).forEach((r: any) => {
      if (r.streak_type in out) out[r.streak_type as StreakType] = r;
    });
  } catch (err) {
    console.warn("[streaks] fetch failed:", err);
  }
  return out;
}

/** Returns streak only if last action was today or yesterday, else 0. */
export function liveStreakValue(row: StreakRow | null): number {
  if (!row || !row.last_action_date) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(row.last_action_date);
  last.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - last.getTime()) / 86400000);
  return days <= 1 ? row.current_streak : 0;
}
