-- Drop the foreign key constraint on notification_preferences that references auth.users
ALTER TABLE public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;

-- Also update the create_unclaimed_profile function to NOT create notification_preferences
-- since that table requires a real auth.users entry
CREATE OR REPLACE FUNCTION public.create_unclaimed_profile(
  p_full_name text, 
  p_role text, 
  p_bio text DEFAULT NULL, 
  p_avatar_url text DEFAULT NULL, 
  p_location text DEFAULT NULL, 
  p_professional_skills jsonb DEFAULT '[]'::jsonb, 
  p_imported_data jsonb DEFAULT '{}'::jsonb, 
  p_imported_from_url text DEFAULT NULL, 
  p_source text DEFAULT 'admin_created'
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

-- Drop the trigger that creates notification_preferences on profile creation
-- since it will fail for unclaimed profiles
DROP TRIGGER IF EXISTS create_notification_preferences_on_profile ON public.profiles;