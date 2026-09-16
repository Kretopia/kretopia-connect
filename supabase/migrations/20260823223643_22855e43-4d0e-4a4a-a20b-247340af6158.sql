-- role is the creative role (text), not a permission: keep it user-editable
GRANT UPDATE (role) ON public.profiles TO authenticated;

-- Award points server-side (capped + logged)
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id uuid, p_amount integer, p_reason text DEFAULT 'activity')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 500 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  UPDATE public.profiles
     SET xp = COALESCE(xp, 0) + p_amount,
         total_xp = COALESCE(total_xp, 0) + p_amount,
         updated_at = now()
   WHERE user_id = p_user_id
  RETURNING xp INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  INSERT INTO public.xp_activities (user_id, activity_type, xp_earned, description)
  VALUES (p_user_id, p_reason, p_amount, p_reason);

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, integer, text) TO authenticated, service_role;

-- Spend points on perks server-side (atomic balance check)
CREATE OR REPLACE FUNCTION public.spend_xp(p_amount integer, p_purpose text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  UPDATE public.profiles
     SET xp = xp - p_amount,
         updated_at = now()
   WHERE user_id = v_uid
     AND COALESCE(xp, 0) >= p_amount
  RETURNING xp INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'not enough points';
  END IF;

  IF p_purpose = 'streak_freeze' THEN
    UPDATE public.profiles
       SET streak_freeze_count = COALESCE(streak_freeze_count, 0) + 1
     WHERE user_id = v_uid;
  ELSIF p_purpose = 'profile_boost' THEN
    UPDATE public.profiles
       SET boost_expires_at = now() + interval '24 hours'
     WHERE user_id = v_uid;
  ELSIF p_purpose = 'double_xp' THEN
    UPDATE public.profiles
       SET double_xp_expires_at = now() + interval '24 hours'
     WHERE user_id = v_uid;
  ELSIF p_purpose = 'pro_trial' THEN
    UPDATE public.profiles
       SET subscription_tier = 'pro',
           subscription_status = 'trialing',
           subscription_end_date = now() + interval '3 days'
     WHERE user_id = v_uid
       AND COALESCE(subscription_tier, 'free') IN ('free', 'spark');
  END IF;

  INSERT INTO public.xp_activities (user_id, activity_type, xp_earned, description)
  VALUES (v_uid, p_purpose, -p_amount, p_purpose);

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_xp(integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.spend_xp(integer, text) TO authenticated, service_role;