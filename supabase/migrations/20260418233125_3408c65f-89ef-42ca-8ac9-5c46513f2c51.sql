
-- 1. BACKFILL verification_tier - industry
UPDATE public.profiles p
SET verification_tier = 'industry'
WHERE (
  (SELECT COUNT(*) FROM public.credits c 
   WHERE c.user_id = p.user_id AND c.verification_status = 'verified') >= 5
  OR
  (SELECT COUNT(*) FROM public.awards a 
   WHERE a.user_id = p.user_id 
   AND (
     a.organization ILIKE '%grammy%' OR a.title ILIKE '%grammy%'
     OR a.organization ILIKE '%oscar%' OR a.organization ILIKE '%academy award%' OR a.title ILIKE '%oscar%'
     OR a.organization ILIKE '%emmy%' OR a.title ILIKE '%emmy%'
     OR a.organization ILIKE '%billboard%' OR a.title ILIKE '%billboard%'
   )) >= 1
);

-- verified: claimed or has at least 1 credit
UPDATE public.profiles p
SET verification_tier = 'verified'
WHERE (verification_tier IS NULL OR verification_tier = '')
  AND (
    p.is_claimed = true
    OR EXISTS (SELECT 1 FROM public.credits c WHERE c.user_id = p.user_id)
  );

-- 2. MIGRATE beta -> og
UPDATE public.profiles
SET badge = 'og'
WHERE badge = 'beta';

-- 3. BACKFILL OG to oldest users (cap 1,000)
WITH current_og AS (
  SELECT COUNT(*) AS cnt FROM public.profiles WHERE badge = 'og'
),
slots AS (
  SELECT GREATEST(0, 1000 - cnt) AS n FROM current_og
),
candidates AS (
  SELECT p.user_id
  FROM public.profiles p
  WHERE p.badge IS NULL
  ORDER BY p.created_at ASC
  LIMIT (SELECT n FROM slots)
)
UPDATE public.profiles
SET badge = 'og'
WHERE user_id IN (SELECT user_id FROM candidates);

-- 4. ENFORCE 1,000 OG cap
CREATE OR REPLACE FUNCTION public.enforce_og_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  og_count INTEGER;
BEGIN
  IF NEW.badge = 'og' AND (OLD.badge IS NULL OR OLD.badge != 'og') THEN
    SELECT COUNT(*) INTO og_count FROM public.profiles WHERE badge = 'og';
    IF og_count >= 1000 THEN
      RAISE EXCEPTION 'OG badge cap reached (1,000 users). No new OG badges can be assigned.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_og_cap ON public.profiles;
CREATE TRIGGER trg_enforce_og_cap
BEFORE INSERT OR UPDATE OF badge ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_og_cap();

-- 5. AUTO-RECOMPUTE TIER on credits/awards changes
CREATE OR REPLACE FUNCTION public.recompute_verification_tier(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  verified_credit_count INTEGER;
  major_award_count INTEGER;
  has_any_credit BOOLEAN;
  is_claimed_profile BOOLEAN;
  new_tier TEXT;
BEGIN
  SELECT COUNT(*) INTO verified_credit_count
  FROM public.credits 
  WHERE user_id = p_user_id AND verification_status = 'verified';

  SELECT COUNT(*) INTO major_award_count
  FROM public.awards
  WHERE user_id = p_user_id
    AND (
      organization ILIKE '%grammy%' OR title ILIKE '%grammy%'
      OR organization ILIKE '%oscar%' OR organization ILIKE '%academy award%' OR title ILIKE '%oscar%'
      OR organization ILIKE '%emmy%' OR title ILIKE '%emmy%'
      OR organization ILIKE '%billboard%' OR title ILIKE '%billboard%'
    );

  SELECT EXISTS(SELECT 1 FROM public.credits WHERE user_id = p_user_id) INTO has_any_credit;
  SELECT COALESCE(is_claimed, false) INTO is_claimed_profile FROM public.profiles WHERE user_id = p_user_id;

  IF verified_credit_count >= 5 OR major_award_count >= 1 THEN
    new_tier := 'industry';
  ELSIF is_claimed_profile OR has_any_credit THEN
    new_tier := 'verified';
  ELSE
    new_tier := NULL;
  END IF;

  UPDATE public.profiles
  SET verification_tier = new_tier
  WHERE user_id = p_user_id
    AND COALESCE(verification_tier, '') != 'elite';
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_tier_on_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_verification_tier(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_credits_recompute_tier ON public.credits;
CREATE TRIGGER trg_credits_recompute_tier
AFTER INSERT OR UPDATE OR DELETE ON public.credits
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_tier_on_credit();

DROP TRIGGER IF EXISTS trg_awards_recompute_tier ON public.awards;
CREATE TRIGGER trg_awards_recompute_tier
AFTER INSERT OR UPDATE OR DELETE ON public.awards
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_tier_on_credit();
