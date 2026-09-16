-- Closes a gap 20260904150000_lock_profiles_privileged_columns.sql
-- explicitly flagged and deliberately deferred: "daily_swipes/
-- last_swipe_reset for the swipe-limit counter... a different problem
-- (client-trusted counters), not what this finding describes."
--
-- src/lib/subscriptionLimits.ts already ships a real, decided value
-- (TIER_LIMITS.free.swipesPerDay = 20, -1/unlimited on every paid tier).
-- Three separate call sites (src/components/circle/ForYouFeed.tsx,
-- src/hooks/useCircleData.ts, src/hooks/useDiscoverData.ts) each
-- independently read profiles.daily_swipes, compute a new count in JS,
-- and PATCH it back directly -- a non-atomic read-then-write with zero
-- server-side enforcement. Any authenticated user can PATCH their own
-- daily_swipes back to 0 (or skip the increment entirely) via a raw
-- REST call, fully bypassing the limit shown in the UI.
--
-- Fix: same atomic check-and-increment RPC pattern used throughout this
-- session, built directly on the existing daily_swipes/last_swipe_reset
-- columns (no new table -- the day-rollover semantics already live
-- there), then REVOKE UPDATE on just those two columns so the RPC is the
-- only write path. Every other profiles column keeps exactly the access
-- it has today -- this is a narrow, additive REVOKE, not a rebuild of
-- the whole table-level grant.

REVOKE UPDATE (daily_swipes, last_swipe_reset) ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.consume_daily_swipe(_user_id UUID, _daily_cap INTEGER)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, cap INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_last_reset DATE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Not authorized to consume another user''s usage';
  END IF;

  SELECT daily_swipes, last_swipe_reset::date INTO v_count, v_last_reset
  FROM public.profiles WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Roll over to a fresh day exactly like the client-side logic did.
  IF v_last_reset IS NULL OR v_last_reset < CURRENT_DATE THEN
    v_count := 0;
  END IF;

  IF _daily_cap <> -1 AND v_count >= _daily_cap THEN
    UPDATE public.profiles
    SET daily_swipes = v_count, last_swipe_reset = now()
    WHERE user_id = _user_id AND (last_swipe_reset IS NULL OR last_swipe_reset::date < CURRENT_DATE);
    RETURN QUERY SELECT false, v_count, _daily_cap;
    RETURN;
  END IF;

  v_count := v_count + 1;

  UPDATE public.profiles
  SET daily_swipes = v_count, last_swipe_reset = now()
  WHERE user_id = _user_id;

  RETURN QUERY SELECT true, v_count, _daily_cap;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_swipe(UUID, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_daily_swipe(UUID, INTEGER) TO authenticated, service_role;
