-- Critical flagged by the deep security scan: "Users can grant themselves
-- referral commissions and reward tiers."
--
-- "The 'referral_network' table policy 'Users can update their own referral
-- network' only checks auth.uid() = user_id, with no WITH CHECK limiting
-- which fields are modified. A user can directly update their own row to
-- set commission_rate, commission_earned, fee_discount_percent,
-- free_pro_months_earned, network_tier, and status_bonus_points to
-- arbitrary values, granting themselves financial rewards and discounts
-- without earning them."
--
-- Confirmed via grep: no client code anywhere in src/ ever inserts or
-- updates this table — both read hooks (useReferralNetwork,
-- useFoundingMemberProgress) only .select() it. The sole legitimate writer
-- is record_referral(), a SECURITY DEFINER function, plus the
-- update_referral_rewards trigger it drives (and that trigger itself only
-- protects the columns it recomputes, not commission_earned/
-- commission_paid/total_network_size/longest_chain, which is exactly the
-- gap the scanner is describing). Since there's no legitimate client write
-- path at all, the fix is a full REVOKE rather than a column exclusion
-- list: drop the client-facing INSERT/UPDATE policies and revoke the
-- underlying table-level grants, leaving record_referral() as the only way
-- this table is ever written.

DROP POLICY IF EXISTS "Users can insert their own referral network" ON public.referral_network;
DROP POLICY IF EXISTS "Users can update their own referral network" ON public.referral_network;

REVOKE INSERT, UPDATE ON public.referral_network FROM authenticated, anon;
