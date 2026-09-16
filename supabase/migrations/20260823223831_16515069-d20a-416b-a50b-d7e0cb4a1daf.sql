CREATE OR REPLACE FUNCTION public.finalize_unclaimed_profile_claim(p_unclaimed_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_unclaimed RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_unclaimed_user_id = v_uid THEN
    RETURN false;
  END IF;

  SELECT * INTO v_unclaimed
  FROM public.profiles
  WHERE user_id = p_unclaimed_user_id
    AND COALESCE(is_claimed, false) = false;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
     SET verification_tier = 'industry',
         updated_at = now()
   WHERE user_id = v_uid;

  UPDATE public.profiles
     SET is_claimed = true,
         claimed_at = now(),
         claimed_by = v_uid
   WHERE user_id = p_unclaimed_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_unclaimed_profile_claim(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalize_unclaimed_profile_claim(uuid) TO authenticated, service_role;