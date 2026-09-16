-- Warning flagged by the deep security scan: "Users can fabricate their
-- own streaks and gamification stats."
--
-- "The UPDATE policies on 'daily_streaks' and 'money_streaks' only check
-- user_id ownership with no WITH CHECK, allowing a user to set
-- current_streak, longest_streak, and total_actions to arbitrary values,
-- artificially inflating gamification stats/leaderboards."
--
-- Confirmed via grep: no client code in src/ ever inserts or updates either
-- table directly — src/lib/streaks.ts and src/lib/moneyStreak.ts only call
-- the bump_streak() and record_money_action() RPCs (both SECURITY DEFINER),
-- and only .select() the tables for display. No legitimate client write
-- path exists, so revoke client write access entirely rather than trying to
-- exclude individual columns.

DROP POLICY IF EXISTS "Users update own streaks" ON public.daily_streaks;
DROP POLICY IF EXISTS "Users insert own streaks" ON public.daily_streaks;
DROP POLICY IF EXISTS "Users update their own money streak" ON public.money_streaks;
DROP POLICY IF EXISTS "Users insert their own money streak" ON public.money_streaks;

REVOKE INSERT, UPDATE ON public.daily_streaks FROM authenticated, anon;
REVOKE INSERT, UPDATE ON public.money_streaks FROM authenticated, anon;
