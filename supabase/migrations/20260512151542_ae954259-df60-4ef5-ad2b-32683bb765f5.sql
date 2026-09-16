CREATE OR REPLACE FUNCTION public.create_unclaimed_profile(
  p_full_name text,
  p_role text,
  p_bio text DEFAULT NULL::text,
  p_avatar_url text DEFAULT NULL::text,
  p_location text DEFAULT NULL::text,
  p_professional_skills jsonb DEFAULT '[]'::jsonb,
  p_imported_data jsonb DEFAULT '{}'::jsonb,
  p_imported_from_url text DEFAULT NULL::text,
  p_source text DEFAULT 'admin_created'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_user_id UUID;
  new_claim_token TEXT;
  v_full_name TEXT;
  v_role TEXT;
  v_bio TEXT;
  v_location TEXT;
BEGIN
  -- Validate full_name
  v_full_name := btrim(coalesce(p_full_name, ''));
  IF length(v_full_name) < 2 OR length(v_full_name) > 120 THEN
    RAISE EXCEPTION 'Invalid full_name: must be 2-120 characters';
  END IF;

  -- Validate role
  v_role := btrim(coalesce(p_role, ''));
  IF length(v_role) < 1 OR length(v_role) > 120 THEN
    RAISE EXCEPTION 'Invalid role: must be 1-120 characters';
  END IF;

  -- Validate / sanitize bio: strip simple HTML tags, cap length
  v_bio := p_bio;
  IF v_bio IS NOT NULL THEN
    v_bio := regexp_replace(v_bio, '<[^>]*>', '', 'g');
    IF length(v_bio) > 5000 THEN
      RAISE EXCEPTION 'Invalid bio: max 5000 characters';
    END IF;
  END IF;

  -- Validate location length
  v_location := p_location;
  IF v_location IS NOT NULL AND length(v_location) > 200 THEN
    RAISE EXCEPTION 'Invalid location: max 200 characters';
  END IF;

  -- Validate avatar_url is https
  IF p_avatar_url IS NOT NULL AND p_avatar_url <> '' AND p_avatar_url !~* '^https://' THEN
    RAISE EXCEPTION 'Invalid avatar_url: must be https://';
  END IF;
  IF p_avatar_url IS NOT NULL AND length(p_avatar_url) > 2048 THEN
    RAISE EXCEPTION 'Invalid avatar_url: too long';
  END IF;

  -- Validate imported_from_url
  IF p_imported_from_url IS NOT NULL AND p_imported_from_url <> '' AND p_imported_from_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Invalid imported_from_url: must be http(s)://';
  END IF;
  IF p_imported_from_url IS NOT NULL AND length(p_imported_from_url) > 2048 THEN
    RAISE EXCEPTION 'Invalid imported_from_url: too long';
  END IF;

  -- Cap JSONB sizes to prevent DoS
  IF p_professional_skills IS NOT NULL AND pg_column_size(p_professional_skills) > 32000 THEN
    RAISE EXCEPTION 'professional_skills payload too large';
  END IF;
  IF p_imported_data IS NOT NULL AND pg_column_size(p_imported_data) > 64000 THEN
    RAISE EXCEPTION 'imported_data payload too large';
  END IF;

  new_user_id := gen_random_uuid();
  new_claim_token := generate_claim_token();

  INSERT INTO public.profiles (
    user_id, full_name, role, bio, avatar_url, location,
    professional_skills, imported_data, imported_from_url,
    is_claimed, claim_token, profile_source,
    onboarding_completed, subscription_tier, subscription_status
  ) VALUES (
    new_user_id, v_full_name, v_role, v_bio, p_avatar_url, v_location,
    coalesce(p_professional_skills, '[]'::jsonb),
    coalesce(p_imported_data, '{}'::jsonb),
    p_imported_from_url,
    false, new_claim_token, p_source,
    true, 'free', 'inactive'
  );

  RETURN new_user_id;
END;
$function$;