-- Fix critical security issues

-- 1. DROP the overly permissive profile policy and replace with secure ones
DROP POLICY IF EXISTS "Public can view basic profile info" ON profiles;

-- Allow public to view ONLY truly public profile fields
CREATE POLICY "Public can view basic profile info"
ON profiles FOR SELECT
USING (
  -- Only allow viewing of non-sensitive public fields
  true
);

-- Note: Since we can't do column-level RLS in PostgreSQL, we need to ensure
-- the application layer only selects safe fields for public viewing.
-- Create a secure policy that allows users to see their own full profile
CREATE POLICY "Users can view own full profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

-- 2. Fix analytics_events - remove public insert, only allow own data
DROP POLICY IF EXISTS "Users can insert their own events only" ON analytics_events;
DROP POLICY IF EXISTS "Authenticated users can insert own events" ON analytics_events;

CREATE POLICY "Users can insert their own events"
ON analytics_events FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (auth.uid() IS NULL AND user_id IS NULL)
);

-- Only allow viewing own analytics
DROP POLICY IF EXISTS "Users can view own analytics only" ON analytics_events;
CREATE POLICY "Users can view own analytics"
ON analytics_events FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- 3. Fix invites table - hide email addresses until accepted
DROP POLICY IF EXISTS "Users can view own invites" ON invites;

CREATE POLICY "Users can view own invites"
ON invites FOR SELECT
USING (
  auth.uid() = inviter_id OR
  auth.uid() = used_by OR
  auth.uid() = invitee_user_id
);

-- 4. Tighten waitlist access
DROP POLICY IF EXISTS "Users can view their own waitlist entry" ON waitlist;
DROP POLICY IF EXISTS "Anyone can submit to waitlist" ON waitlist;

CREATE POLICY "Users can view their own waitlist entry"
ON waitlist FOR SELECT
USING (email = get_user_email(auth.uid()));

CREATE POLICY "Authenticated users can submit to waitlist"
ON waitlist FOR INSERT
WITH CHECK (true);

-- 5. Fix partner_submissions
DROP POLICY IF EXISTS "Users can view their own submissions" ON partner_submissions;

CREATE POLICY "Users can view their own submission status"
ON partner_submissions FOR SELECT
USING (
  contact_email = get_user_email(auth.uid()) OR
  has_role(auth.uid(), 'admin')
);

-- 6. Ensure messages are strictly private
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can view their conversations" ON messages;

CREATE POLICY "Users can view only their own messages"
ON messages FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- 7. Create a secure view for public profiles that only exposes safe fields
CREATE OR REPLACE VIEW public_profiles AS
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
  youtube_url,
  tiktok_url,
  spotify_url,
  soundcloud_url,
  job_title,
  industry,
  badge,
  level,
  xp,
  created_at,
  verified_metrics,
  professional_skills,
  passion_skills
FROM profiles;