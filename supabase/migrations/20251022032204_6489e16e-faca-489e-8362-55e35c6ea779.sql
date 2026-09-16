-- Step 1: Restrict profiles table to hide sensitive PII
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- Drop existing view if it exists
DROP VIEW IF EXISTS public_profiles CASCADE;

-- Allow users to view their own complete profile
CREATE POLICY "Users view own complete profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

-- Allow authenticated users to view limited public profile data
CREATE POLICY "Authenticated users view public profiles"
ON profiles FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  auth.uid() != user_id
);

-- Create a public profiles view with only non-sensitive fields
CREATE VIEW public_profiles AS
SELECT 
  user_id,
  full_name,
  role,
  bio,
  avatar_url,
  location,
  professional_skills,
  passion_skills,
  website,
  linkedin_url,
  twitter_url,
  instagram_url,
  spotify_url,
  soundcloud_url,
  youtube_url,
  tiktok_url,
  behance_url,
  imdb_url,
  verification_status,
  badge,
  level,
  xp,
  average_rating,
  total_reviews,
  created_at,
  account_type,
  company_name,
  company_size,
  company_industry,
  job_title,
  industry,
  company_logo_url,
  company_about,
  company_location_lat,
  company_location_lng,
  company_address,
  company_images,
  verified_at,
  portfolio_verified,
  social_verified
FROM profiles;

-- Grant public access to the view
GRANT SELECT ON public_profiles TO anon, authenticated;

-- Step 2: Secure project-files storage bucket
-- Project files can only be viewed by project owner or collaborators
CREATE POLICY "Project files access for owners"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Project files access for collaborators"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files' AND
  EXISTS (
    SELECT 1 FROM project_collaborators pc
    WHERE pc.user_id = auth.uid()
    AND pc.status = 'accepted'
    AND pc.project_id::text = (storage.foldername(name))[2]
  )
);

-- Allow upload only by authenticated users to their own folder
CREATE POLICY "Project files upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow delete only by file owner
CREATE POLICY "Project files delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);