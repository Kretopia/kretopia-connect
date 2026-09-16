-- Track manual founder circle grants by admins (audit log)
CREATE TABLE IF NOT EXISTS public.founder_circle_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  reason TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.founder_circle_grants ENABLE ROW LEVEL SECURITY;

-- Only admins can view/insert grants
CREATE POLICY "Admins can view all founder grants"
  ON public.founder_circle_grants FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create founder grants"
  ON public.founder_circle_grants FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND granted_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_founder_grants_user ON public.founder_circle_grants(user_id);

-- Admin RPC: grant founder circle to a user (idempotent)
CREATE OR REPLACE FUNCTION public.admin_grant_founder_circle(
  target_user_id UUID,
  grant_reason TEXT DEFAULT 'Focus group participant'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_current_tier TEXT;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can grant founder circle';
  END IF;

  -- Read current tier
  SELECT subscription_tier INTO v_current_tier
  FROM public.profiles
  WHERE user_id = target_user_id;

  IF v_current_tier IS NULL THEN
    RAISE EXCEPTION 'Target user profile not found';
  END IF;

  IF v_current_tier = 'founder' THEN
    RETURN jsonb_build_object('success', true, 'already_founder', true);
  END IF;

  -- Upgrade profile to founder
  UPDATE public.profiles
  SET subscription_tier = 'founder',
      updated_at = now()
  WHERE user_id = target_user_id;

  -- Log the grant
  INSERT INTO public.founder_circle_grants (user_id, granted_by, reason)
  VALUES (target_user_id, v_admin_id, grant_reason);

  -- Add a completed founder_circle_purchases row so spot count stays accurate (manual gift)
  INSERT INTO public.founder_circle_purchases (user_id, status, amount, stripe_session_id)
  VALUES (target_user_id, 'completed', 0, 'manual-grant-' || target_user_id::text || '-' || extract(epoch from now())::text);

  RETURN jsonb_build_object('success', true, 'already_founder', false);
END;
$$;