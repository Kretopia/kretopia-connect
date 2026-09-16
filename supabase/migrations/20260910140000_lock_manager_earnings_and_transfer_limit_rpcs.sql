-- ============================================================
-- Security hardening phase 2 -- gap fill on two SECURITY DEFINER RPCs
-- found via background audit (2026-09-10) to have no REVOKE/GRANT at
-- all, unlike every other money-touching RPC in this codebase
-- (wallet_credit/wallet_debit, update_milestone_workflow_status, etc.
-- all lock to service_role). Postgres grants EXECUTE to PUBLIC by
-- default on function creation, so both were callable directly by any
-- authenticated client via supabase.rpc(...).
--
-- 1. increment_manager_earnings(manager_id_input, amount_input)
--    (20260326235045_...sql): no internal auth.uid() check, updates
--    talent_managers.total_earned by an arbitrary caller-supplied
--    amount for an arbitrary manager_id. Confirmed both real callers
--    (stripe-marketplace-webhook, capture-milestone-payment) already
--    use the service_role client -- restricting to service_role is a
--    pure gap-fill, not a behavior change for legitimate callers.
--
-- 2. check_transfer_limit(p_user_id, p_amount, p_currency)
--    (20260306101009_...sql): no internal auth.uid() check, lets any
--    authenticated caller read another user's subscription tier and
--    daily/monthly wallet-transfer spend by passing their user_id.
--    Confirmed the only real caller (wallet-transfer/index.ts) already
--    uses the service_role client with the verified caller's own
--    user.id -- restricting to service_role is a pure gap-fill.
--
-- Idempotent: REVOKE/GRANT are naturally idempotent, no guard needed.
-- ============================================================

REVOKE ALL ON FUNCTION public.increment_manager_earnings(uuid, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_manager_earnings(uuid, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.check_transfer_limit(uuid, numeric, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_transfer_limit(uuid, numeric, text) TO service_role;
