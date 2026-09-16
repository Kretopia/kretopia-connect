import { supabase } from "@/integrations/supabase/client";

// XP rewards for platform activities (formerly credits, now unified into XP)
export const XP_REWARDS = {
  PROFILE_COMPLETE: 100,
  CONNECTION_MADE: 25,
  PROJECT_COMPLETED: 500,
  REVIEW_RECEIVED: 150,
  DAILY_LOGIN: 10,
  OPPORTUNITY_POSTED: 50,
  PARTNER_VISIT: 20,
  MILESTONE_COMPLETED: 200,
} as const;

// Legacy alias
export const CREDIT_REWARDS = XP_REWARDS;

export const awardXP = async (
  userId: string,
  amount: number,
  type: string,
  description: string
) => {
  try {
    // Points are awarded server-side (capped + logged)
    await supabase.rpc('award_xp' as any, {
      p_user_id: userId,
      p_amount: amount,
      p_reason: type,
    });

    // Record XP activity
    await supabase
      .from('xp_activities')
      .insert({
        user_id: userId,
        activity_type: type,
        xp_earned: amount,
        description,
      });

    return { success: true };
  } catch (error) {
    console.error('Error awarding XP:', error);
    return { success: false, error };
  }
};

// Legacy alias
export const awardCredits = awardXP;

export const checkAndAwardDailyLogin = async (userId: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: existingActivity, error: checkError } = await supabase
      .from('xp_activities')
      .select('*')
      .eq('user_id', userId)
      .eq('activity_type', 'daily_login')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking daily login:', checkError);
      return { awarded: false, error: checkError };
    }

    if (!existingActivity) {
      await awardXP(
        userId,
        XP_REWARDS.DAILY_LOGIN,
        'daily_login',
        'Daily login bonus'
      );
      return { awarded: true };
    }

    return { awarded: false, message: 'Already claimed today' };
  } catch (error) {
    console.error('Error checking daily login:', error);
    return { awarded: false, error };
  }
};
