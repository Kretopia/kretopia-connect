-- Sub-roles for multi-role support (Producer + Photographer + Singer, etc.)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sub_roles text[] DEFAULT ARRAY[]::text[];

-- Tier-based storage limit function
CREATE OR REPLACE FUNCTION public.get_tier_storage_limit(tier text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN tier = 'creator_pro' THEN 107374182400::bigint  -- 100 GB
    WHEN tier = 'founder' THEN 107374182400::bigint
    WHEN tier = 'brand_enterprise' THEN 268435456000::bigint -- 250 GB
    WHEN tier = 'brand_pro' THEN 107374182400::bigint
    WHEN tier = 'pro' THEN 26843545600::bigint  -- 25 GB
    ELSE 2147483648::bigint  -- 2 GB free
  END;
$$;

-- Backfill existing users
UPDATE public.profiles
SET storage_limit_bytes = public.get_tier_storage_limit(subscription_tier);

-- Trigger to auto-apply on tier change
CREATE OR REPLACE FUNCTION public.apply_tier_storage_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier OR OLD IS NULL THEN
    NEW.storage_limit_bytes := public.get_tier_storage_limit(NEW.subscription_tier);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_tier_storage_limit ON public.profiles;
CREATE TRIGGER trg_apply_tier_storage_limit
BEFORE INSERT OR UPDATE OF subscription_tier ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.apply_tier_storage_limit();