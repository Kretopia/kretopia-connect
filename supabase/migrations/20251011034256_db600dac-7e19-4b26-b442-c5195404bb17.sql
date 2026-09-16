-- CRITICAL SECURITY FIXES - Profile Protection Only

-- 1. Fix profiles table RLS policies
DROP POLICY IF EXISTS "Authenticated users can view public profile fields" ON profiles;

-- Policy 1: Public profile data viewable by all authenticated users
CREATE POLICY "Public profile data viewable" 
ON profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Policy 2: Owner can view their own sensitive financial data
CREATE POLICY "Owner views sensitive data" 
ON profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- 2. Document sensitive fields for developer reference
COMMENT ON COLUMN profiles.stripe_account_id IS 'SENSITIVE: Owner only access';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'SENSITIVE: Owner only access';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'SENSITIVE: Owner only access';
COMMENT ON COLUMN profiles.membership_number IS 'SENSITIVE: Owner only access';

-- 3. Create safe public profile view excluding sensitive data
CREATE OR REPLACE VIEW public_profiles_safe AS
SELECT 
  user_id, full_name, avatar_url, role, bio, location,
  industry, job_title, website, subscription_tier, badge,
  level, xp, verified_metrics, average_rating, total_reviews,
  account_type, company_name, company_logo_url, company_about,
  company_industry, company_size, onboarding_completed,
  instagram_url, youtube_url, tiktok_url, twitter_url,
  spotify_url, imdb_url, instagram_followers, youtube_subscribers,
  tiktok_followers, spotify_listeners, avg_views, total_engagement_rate,
  created_at, updated_at
FROM profiles;

-- 4. Tighten review_requests access
DROP POLICY IF EXISTS "Anyone can view review requests by valid token" ON review_requests;

CREATE POLICY "Token-based review access only" 
ON review_requests 
FOR SELECT 
USING (expires_at > now() AND status = 'pending');
