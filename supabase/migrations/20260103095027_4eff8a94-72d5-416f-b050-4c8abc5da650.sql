-- Update the create_unclaimed_profile function to accept avatar_url parameter
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
BEGIN
  -- Generate a new UUID for the unclaimed profile
  new_user_id := gen_random_uuid();
  new_claim_token := generate_claim_token();
  
  -- Insert the unclaimed profile (no FK constraint on user_id anymore)
  -- NOTE: We do NOT create notification_preferences for unclaimed profiles
  -- as those require a real auth.users entry
  INSERT INTO public.profiles (
    user_id,
    full_name,
    role,
    bio,
    avatar_url,
    location,
    professional_skills,
    imported_data,
    imported_from_url,
    is_claimed,
    claim_token,
    profile_source,
    onboarding_completed,
    subscription_tier,
    subscription_status
  ) VALUES (
    new_user_id,
    p_full_name,
    p_role,
    p_bio,
    p_avatar_url,
    p_location,
    p_professional_skills,
    p_imported_data,
    p_imported_from_url,
    false,
    new_claim_token,
    p_source,
    true,
    'free',
    'inactive'
  );
  
  RETURN new_user_id;
END;
$function$;