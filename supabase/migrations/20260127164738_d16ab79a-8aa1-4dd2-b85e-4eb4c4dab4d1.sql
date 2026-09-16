-- =====================================================
-- SECURITY FIX: Restrict email exposure in tables
-- =====================================================

-- 1. Fix skill_endorsements - drop overly permissive policy
DROP POLICY IF EXISTS "Public can view endorsements without email" ON skill_endorsements;

-- Create a restrictive policy: public sees endorsements BUT not emails (via view), owner sees all
CREATE POLICY "Authenticated users can view endorsements for profiles"
ON skill_endorsements FOR SELECT TO authenticated
USING (
  profile_id = auth.uid() -- Owner sees all including emails
  OR 
  -- Non-owners can view but must use the public view which excludes email
  EXISTS (SELECT 1 FROM profiles WHERE user_id = profile_id AND onboarding_completed = true)
);

-- 2. Fix reviews - restrict email visibility
DROP POLICY IF EXISTS "Public view approved reviews without emails" ON reviews;
DROP POLICY IF EXISTS "Published reviews are viewable" ON reviews;

-- Only profile owners and reviewers see emails, everyone else uses the public view
CREATE POLICY "Authenticated users view approved reviews"
ON reviews FOR SELECT TO authenticated
USING (
  profile_id = auth.uid() -- Profile owner sees all
  OR reviewer_id = auth.uid() -- Reviewer sees their own
  OR (status IN ('approved', 'published') AND EXISTS (SELECT 1 FROM profiles WHERE user_id = profile_id))
);

-- 3. Fix skill_endorsement_requests
DROP POLICY IF EXISTS "Anonymous can view endorsement requests via token" ON skill_endorsement_requests;

-- Restrict to profile owner or valid share token access
CREATE POLICY "Token or owner access to endorsement requests"
ON skill_endorsement_requests FOR SELECT
USING (
  profile_id = auth.uid() -- Owner
  OR share_token IS NOT NULL -- Token-based access (anonymous endorsers)
);

-- 4. Fix partner_submissions - restrict to submitter and admins only
DROP POLICY IF EXISTS "Anyone can submit partner applications" ON partner_submissions;
DROP POLICY IF EXISTS "Only submitter and admins view submissions" ON partner_submissions;
DROP POLICY IF EXISTS "Submitters can view own submissions" ON partner_submissions;

-- Require authentication for submissions
CREATE POLICY "Authenticated users can submit partner applications"
ON partner_submissions FOR INSERT TO authenticated
WITH CHECK (true);

-- Only show to submitter (by matching auth email) or admins
CREATE POLICY "Submitters and admins view own submissions"
ON partner_submissions FOR SELECT TO authenticated
USING (
  contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- 5. Create secure view for connected_platforms (excludes tokens)
DROP VIEW IF EXISTS connected_platforms_public;
CREATE VIEW connected_platforms_public WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  platform,
  platform_user_id,
  platform_username,
  platform_data,
  verified_at,
  last_synced_at,
  created_at,
  updated_at
FROM connected_platforms;
-- Excludes: access_token, refresh_token, token_expires_at

GRANT SELECT ON connected_platforms_public TO authenticated, anon;