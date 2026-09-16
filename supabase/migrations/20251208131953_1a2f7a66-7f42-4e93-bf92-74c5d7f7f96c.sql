-- Fix Security Definer View warning by using SECURITY INVOKER (default)
-- Drop and recreate the view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public_profiles_safe;

CREATE VIEW public_profiles_safe 
WITH (security_invoker = true) AS
SELECT 
    user_id,
    full_name,
    role,
    bio,
    location,
    avatar_url,
    website,
    linkedin_url,
    behance_url,
    imdb_url,
    instagram_url,
    twitter_url,
    spotify_url,
    soundcloud_url,
    youtube_url,
    tiktok_url,
    professional_skills,
    passion_skills,
    badge,
    level,
    xp,
    average_rating,
    total_reviews,
    created_at,
    account_type,
    company_name,
    company_logo_url,
    company_about,
    company_address,
    company_location_lat,
    company_location_lng,
    company_images,
    company_size,
    company_industry,
    verified_at,
    portfolio_verified,
    social_verified,
    verification_status,
    job_title,
    industry,
    collab_intent,
    youtube_subscribers,
    instagram_followers,
    tiktok_followers,
    spotify_listeners,
    twitter_followers,
    linkedin_connections,
    total_engagement_rate,
    avg_views,
    verified_metrics,
    subscription_tier
FROM profiles
WHERE verification_status <> 'rejected';

-- Grant access to the safe view
GRANT SELECT ON public_profiles_safe TO authenticated;
GRANT SELECT ON public_profiles_safe TO anon;