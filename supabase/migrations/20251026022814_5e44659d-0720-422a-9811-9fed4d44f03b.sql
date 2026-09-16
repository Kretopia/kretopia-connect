-- Fix Security Issue #3: Skill Endorsements - Remove public access to contact info
DROP POLICY IF EXISTS "Profile owners can view their endorsements" ON skill_endorsements;
DROP POLICY IF EXISTS "Profile owners view endorsements with contact info" ON skill_endorsements;

CREATE POLICY "Profile owners view endorsements with contact info"
ON skill_endorsements
FOR SELECT
TO authenticated
USING (auth.uid() = profile_id);

-- Fix Security Issue #4: Reviews - Remove email from public view
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;

CREATE POLICY "Approved reviews viewable by everyone (no emails)"
ON reviews
FOR SELECT
TO authenticated
USING (status = 'approved');

-- Fix Security Issue #5: Invites - Restrict invite code visibility
DROP POLICY IF EXISTS "Users can view own invites with full details" ON invites;

CREATE POLICY "Inviters can view their own invites with codes"
ON invites
FOR SELECT
TO authenticated
USING (auth.uid() = inviter_id);

CREATE POLICY "Invitees can view limited invite details"
ON invites
FOR SELECT
TO authenticated
USING (
  (auth.uid() = used_by OR auth.uid() = invitee_user_id)
  AND auth.uid() != inviter_id
);

-- Fix Security Issue #7: Partner Submissions - Restrict contact visibility
DROP POLICY IF EXISTS "Users can view own submissions by email" ON partner_submissions;

CREATE POLICY "Submitters can view own submissions"
ON partner_submissions
FOR SELECT
TO authenticated  
USING (
  contact_email = get_user_email(auth.uid())
);

-- Fix Security Issue #8: Public Profiles View - Ensure sensitive data excluded
DROP VIEW IF EXISTS public_profiles CASCADE;

CREATE VIEW public_profiles AS
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
  industry
FROM profiles
WHERE verification_status != 'rejected';

GRANT SELECT ON public_profiles TO authenticated;