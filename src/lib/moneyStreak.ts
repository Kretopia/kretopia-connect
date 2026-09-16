import { supabase } from "@/integrations/supabase/client";

export type MoneyAction =
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "expense_added"
  | "receipt_scanned"
  | "quote_sent"
  | "payment_received"
  | "payment_sent";

/**
 * Records a money action and bumps the user's daily money streak.
 * Safe to fire-and-forget. Failures are logged, never thrown.
 */
export async function recordMoneyAction(action: MoneyAction) {
  try {
    const { data, error } = await supabase.rpc("record_money_action", {
      _action_type: action,
    });
    if (error) {
      console.warn("[moneyStreak] record failed:", error.message);
      return null;
    }
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.warn("[moneyStreak] exception:", err);
    return null;
  }
}

export async function getMoneyStreak(userId: string) {
  try {
    const { data } = await supabase
      .from("money_streaks")
      .select("current_streak, longest_streak, last_action_date, total_actions")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  } catch (err) {
    console.warn("[moneyStreak] fetch failed:", err);
    return null;
  }
}
