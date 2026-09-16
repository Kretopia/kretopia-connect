
-- Fix 1: Set search_path on functions missing it
CREATE OR REPLACE FUNCTION public.update_community_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities 
    SET member_count = member_count + 1 
    WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities 
    SET member_count = member_count - 1 
    WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_entry_vote_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE challenge_entries 
    SET vote_count = vote_count + 1 
    WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE challenge_entries 
    SET vote_count = vote_count - 1 
    WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$function$;

-- Fix 2: Recreate views with SECURITY INVOKER to fix Security Definer View warnings
-- Views should use the permissions of the CALLING user, not the view creator

-- Recreate public_profiles with SECURITY INVOKER
DROP VIEW IF EXISTS public_profiles;
CREATE VIEW public_profiles WITH (security_invoker = on) AS
SELECT user_id, full_name, role, bio, location, avatar_url, website,
       linkedin_url, behance_url, imdb_url, instagram_url, twitter_url,
       spotify_url, soundcloud_url, youtube_url, tiktok_url,
       professional_skills, passion_skills, badge, level, xp,
       average_rating, total_reviews, created_at, account_type,
       company_name, company_logo_url, company_about, company_address,
       company_location_lat, company_location_lng, company_images,
       company_size, company_industry, verified_at, portfolio_verified,
       social_verified, verification_status, job_title, industry
FROM profiles
WHERE verification_status <> 'rejected';

-- Recreate public_profiles_safe with SECURITY INVOKER
DROP VIEW IF EXISTS public_profiles_safe;
CREATE VIEW public_profiles_safe WITH (security_invoker = on) AS
SELECT user_id, full_name, avatar_url, bio, role, location, created_at
FROM profiles;

-- Recreate public_profiles_view with SECURITY INVOKER  
DROP VIEW IF EXISTS public_profiles_view;
CREATE VIEW public_profiles_view WITH (security_invoker = on) AS
SELECT user_id, full_name, role, bio, avatar_url, location, job_title, industry,
       professional_skills, passion_skills, website, linkedin_url, behance_url,
       imdb_url, instagram_url, twitter_url, spotify_url, soundcloud_url,
       badge, created_at
FROM profiles;

-- Grant access to the views
GRANT SELECT ON public_profiles TO anon, authenticated;
GRANT SELECT ON public_profiles_safe TO anon, authenticated;
GRANT SELECT ON public_profiles_view TO anon, authenticated;
