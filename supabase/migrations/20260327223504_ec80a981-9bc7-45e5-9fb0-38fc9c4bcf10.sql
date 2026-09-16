
-- FIX: credit_endorsements - restrict SELECT
DROP POLICY IF EXISTS "Anyone can view endorsements" ON credit_endorsements;
CREATE POLICY "Owner and endorser can view endorsements"
ON credit_endorsements FOR SELECT
TO authenticated
USING (
  requested_by = auth.uid() 
  OR endorser_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- FIX: Convert all security definer views to security invoker

-- 1. feed_profiles
DROP VIEW IF EXISTS public.feed_profiles;
CREATE VIEW public.feed_profiles
WITH (security_invoker = true)
AS
SELECT user_id, full_name, avatar_url, role
FROM profiles;

-- 2. public_profiles_view  
DROP VIEW IF EXISTS public.public_profiles_view;
CREATE VIEW public.public_profiles_view
WITH (security_invoker = true)
AS
SELECT user_id, full_name, role, bio, avatar_url, location,
  job_title, industry, professional_skills, passion_skills,
  website, linkedin_url, behance_url, imdb_url, instagram_url,
  twitter_url, spotify_url, soundcloud_url, badge, created_at
FROM profiles;

-- 3. public_profiles
DROP VIEW IF EXISTS public.public_profiles CASCADE;
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT user_id, full_name, role, bio, location, avatar_url,
  website, linkedin_url, behance_url, imdb_url, instagram_url,
  twitter_url, spotify_url, soundcloud_url, youtube_url, tiktok_url,
  professional_skills, passion_skills, badge, level, xp,
  average_rating, total_reviews, created_at, account_type,
  company_name, company_logo_url, company_about, company_address,
  company_location_lat, company_location_lng, company_images,
  company_size, company_industry, verified_at, portfolio_verified,
  social_verified, verification_status, job_title, industry
FROM profiles
WHERE verification_status <> 'rejected';

-- 4. public_profiles_discovery
DROP VIEW IF EXISTS public.public_profiles_discovery;
CREATE VIEW public.public_profiles_discovery
WITH (security_invoker = true)
AS
SELECT user_id, full_name, avatar_url, role, bio, location,
  professional_skills, passion_skills, badge, verification_score,
  level, xp, account_type, company_name, company_logo_url,
  job_title, industry, collab_intent, onboarding_completed, created_at
FROM profiles p
WHERE onboarding_completed = true
  AND is_claimed = true
  AND avatar_url IS NOT NULL AND avatar_url <> ''
  AND bio IS NOT NULL AND length(bio) >= 20
  AND full_name IS NOT NULL AND full_name <> 'New User' AND full_name <> ''
  AND role IS NOT NULL AND role <> 'Creator' AND role <> ''
  AND (
    EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.user_id = p.user_id)
    OR EXISTS (SELECT 1 FROM credits c WHERE c.user_id = p.user_id)
  );
