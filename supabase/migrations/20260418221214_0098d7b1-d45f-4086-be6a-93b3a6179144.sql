-- 1. Update handle_new_user to capture OAuth avatar from Google/Apple metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  provided_invite_code TEXT;
  inviter_record RECORD;
  user_account_type public.account_type;
  oauth_avatar TEXT;
  oauth_name TEXT;
BEGIN
  IF (new.raw_user_meta_data->>'account_type') = 'company' THEN
    user_account_type := 'company'::public.account_type;
  ELSE
    user_account_type := 'individual'::public.account_type;
  END IF;

  provided_invite_code := new.raw_user_meta_data->>'invite_code';

  -- Pull avatar from OAuth providers (Google uses 'picture' or 'avatar_url', Apple may pass 'avatar_url')
  oauth_avatar := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    new.raw_user_meta_data->>'profile_picture'
  );

  -- Pull name from OAuth (Google uses 'full_name' or 'name')
  oauth_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'full_name', ''),
    NULLIF(new.raw_user_meta_data->>'name', ''),
    'New User'
  );

  -- Look up inviter for badge inheritance
  IF provided_invite_code IS NOT NULL THEN
    SELECT i.inviter_id, p.badge INTO inviter_record
    FROM public.invites i
    LEFT JOIN public.profiles p ON p.user_id = i.inviter_id
    WHERE LOWER(i.invite_code) = LOWER(provided_invite_code)
      AND i.current_uses < i.max_uses
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, role, account_type, onboarding_completed,
    xp, level, invites_remaining, badge, avatar_url
  )
  VALUES (
    NEW.id,
    oauth_name,
    CASE WHEN user_account_type = 'company' THEN 'Company' ELSE 'Creator' END,
    user_account_type,
    false,
    0,
    1,
    5,
    CASE WHEN inviter_record.badge IS NOT NULL THEN inviter_record.badge ELSE NULL END,
    oauth_avatar
  )
  ON CONFLICT (user_id) DO UPDATE SET
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    full_name = COALESCE(NULLIF(public.profiles.full_name, 'New User'), EXCLUDED.full_name);

  RETURN NEW;
END;
$function$;

-- 2. Trigger to auto-promote connected platform avatar to profile if profile has none
CREATE OR REPLACE FUNCTION public.sync_platform_avatar_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  platform_avatar TEXT;
BEGIN
  -- Extract avatar URL from platform_data (different platforms use different keys)
  platform_avatar := COALESCE(
    NEW.platform_data->>'avatar_url',
    NEW.platform_data->>'imageUrl',
    NEW.platform_data->>'image_url',
    NEW.platform_data->>'profile_image_url',
    NEW.platform_data->'user'->>'avatar_url',
    NEW.platform_data->'user'->>'imageUrl',
    NEW.platform_data->'profile'->>'image'
  );

  IF platform_avatar IS NOT NULL AND platform_avatar != '' THEN
    UPDATE public.profiles
    SET avatar_url = platform_avatar
    WHERE user_id = NEW.user_id
      AND (avatar_url IS NULL OR avatar_url = '');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_platform_avatar_trigger ON public.connected_platforms;
CREATE TRIGGER sync_platform_avatar_trigger
AFTER INSERT OR UPDATE ON public.connected_platforms
FOR EACH ROW
EXECUTE FUNCTION public.sync_platform_avatar_to_profile();

-- 3. Backfill: pull avatars from connected_platforms for existing users missing avatars
UPDATE public.profiles p
SET avatar_url = sub.platform_avatar
FROM (
  SELECT DISTINCT ON (cp.user_id)
    cp.user_id,
    COALESCE(
      cp.platform_data->>'avatar_url',
      cp.platform_data->>'imageUrl',
      cp.platform_data->>'image_url',
      cp.platform_data->>'profile_image_url',
      cp.platform_data->'user'->>'avatar_url',
      cp.platform_data->'user'->>'imageUrl',
      cp.platform_data->'profile'->>'image'
    ) AS platform_avatar
  FROM public.connected_platforms cp
  ORDER BY cp.user_id, cp.verified_at DESC NULLS LAST
) sub
WHERE p.user_id = sub.user_id
  AND (p.avatar_url IS NULL OR p.avatar_url = '')
  AND sub.platform_avatar IS NOT NULL
  AND sub.platform_avatar != '';

-- 4. Backfill from auth.users OAuth metadata for existing users missing avatars
UPDATE public.profiles p
SET avatar_url = COALESCE(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture',
  u.raw_user_meta_data->>'profile_picture'
)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.avatar_url IS NULL OR p.avatar_url = '')
  AND COALESCE(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture',
    u.raw_user_meta_data->>'profile_picture'
  ) IS NOT NULL;