-- 1) Column-level protection for sensitive profile fields ---------------------
REVOKE SELECT ON public.profiles FROM anon, authenticated;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name NOT IN (
      'phone_otp','phone_otp_expires_at','phone_number',
      'stripe_customer_id','stripe_subscription_id','stripe_account_id'
    );

  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', cols);
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon', cols);
END $$;

GRANT ALL ON public.profiles TO service_role;

-- 2) Owner-only access to their own payment identifiers ----------------------
CREATE OR REPLACE FUNCTION public.get_own_payment_identifiers()
RETURNS TABLE(
  stripe_account_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_account_status text,
  subscription_tier text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.stripe_account_id,
         p.stripe_customer_id,
         p.stripe_subscription_id,
         p.stripe_account_status,
         p.subscription_tier
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_own_payment_identifiers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_payment_identifiers() TO authenticated, service_role;

-- 3) Replace the SECURITY DEFINER view with an invoker view over a
--    security-definer function that only ever returns safe public columns.
CREATE OR REPLACE FUNCTION public.get_public_profiles_safe()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  role text,
  bio text,
  location text,
  professional_skills jsonb,
  badge public.user_badge,
  xp integer,
  level integer,
  onboarding_completed boolean,
  account_type public.account_type,
  instagram_url text,
  tiktok_url text,
  youtube_url text,
  twitter_url text,
  linkedin_url text,
  id_verified boolean,
  verification_status text,
  verification_tier text,
  membership_number text,
  cover_image_url text,
  behance_url text,
  imdb_url text,
  soundcloud_url text,
  spotify_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id, p.full_name, p.username, p.avatar_url, p.role, p.bio, p.location,
         p.professional_skills, p.badge, p.xp, p.level, p.onboarding_completed,
         p.account_type, p.instagram_url, p.tiktok_url, p.youtube_url, p.twitter_url,
         p.linkedin_url, p.id_verified, p.verification_status, p.verification_tier,
         p.membership_number, p.cover_image_url, p.behance_url, p.imdb_url,
         p.soundcloud_url, p.spotify_url, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.is_hidden_backer = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profiles_safe() TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.public_profiles_safe
WITH (security_invoker = true) AS
  SELECT * FROM public.get_public_profiles_safe();

GRANT SELECT ON public.public_profiles_safe TO anon, authenticated, service_role;