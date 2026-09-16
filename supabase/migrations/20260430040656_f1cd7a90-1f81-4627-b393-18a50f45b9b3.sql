-- Founding Member quest progress
CREATE TABLE public.founding_member_quests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quest_key TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_key)
);

CREATE INDEX idx_founding_member_quests_user ON public.founding_member_quests(user_id);

ALTER TABLE public.founding_member_quests ENABLE ROW LEVEL SECURITY;

-- Users manage their own quest rows
CREATE POLICY "Users view own founding quests"
  ON public.founding_member_quests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own founding quests"
  ON public.founding_member_quests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own founding quests"
  ON public.founding_member_quests
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view everything (uses existing has_role / app_role pattern)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins view all founding quests"
        ON public.founding_member_quests
        FOR SELECT
        USING (public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
  END IF;
END $$;

-- Touch updated_at
CREATE TRIGGER trg_founding_member_quests_updated_at
  BEFORE UPDATE ON public.founding_member_quests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Award the founding_member badge if the user has all 3 quests complete.
-- Will not overwrite a higher-tier badge (founder / og stay sticky).
CREATE OR REPLACE FUNCTION public.award_founding_member_badge(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_done INT;
  v_current public.user_badge;
BEGIN
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_done
  FROM public.founding_member_quests
  WHERE user_id = _user_id
    AND completed = true
    AND quest_key IN ('claim_profile', 'log_credits', 'invite_signups');

  IF v_done < 3 THEN
    RETURN FALSE;
  END IF;

  SELECT badge INTO v_current FROM public.profiles WHERE user_id = _user_id;

  -- Don't downgrade higher-priority badges
  IF v_current IN ('founder'::public.user_badge, 'og'::public.user_badge, 'founding_member'::public.user_badge) THEN
    RETURN v_current = 'founding_member'::public.user_badge;
  END IF;

  UPDATE public.profiles
  SET badge = 'founding_member'::public.user_badge,
      updated_at = now()
  WHERE user_id = _user_id;

  RETURN TRUE;
END;
$$;